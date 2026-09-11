/**
 * GET /api/cron/email-follow-ups
 *
 * Invoked daily by Vercel Cron (see vercel.json). Scans every pending
 * email_follow_ups row created by trackFollowUpIfEnabled
 * (lib/workflow/nodeExecutors.ts) and, for each one, either:
 *
 *   - Marks it `status = 'overdue'` once `deadline_at` (a fixed expiration —
 *     never moved once set) has passed.
 *   - Sends the next reminder once enough of the total
 *     `deadline_at - created_at` window has elapsed. Reminder k (1-indexed)
 *     fires once `elapsed / totalDuration >= 1 - 0.5^k` — i.e. the first
 *     reminder at 50% elapsed, the second at 75%, the third at 87.5%,
 *     asymptotically approaching (never reaching) the deadline. Computed
 *     fresh from created_at/deadline_at every run, so a late or repeated
 *     cron tick still detects and sends whatever reminder is due — see
 *     reserveNextReminder's compare-and-swap for why it can't double-send.
 *
 * Resolution (both modes independent of reminders): 'reply' has no
 * inbound-email detection yet; 'receipt' is resolved separately by
 * signature-actions.ts when the lawyer approves the client's documents.
 *
 * Auth: Vercel signs cron requests with `Authorization: Bearer $CRON_SECRET`
 * when CRON_SECRET is set — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { fetchLegalProcess, fetchClientData } from '@/lib/workflow/workflowRunner';
import { substituteVars, resolveBodyHtml } from '@/lib/workflow/nodeExecutors';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';
import { createLogger } from '@/lib/utils/logger';
import type { ExecutionContext, WorkflowRunRow } from '@/lib/workflow/types';

export const dynamic = 'force-dynamic';

const logger = createLogger('CRON:EMAIL_FOLLOW_UPS');

interface EmailFollowUpRow {
  id: string;
  organization_id: string;
  legal_process_id: string;
  workflow_run_id: string | null;
  node_id: string;
  to_email: string;
  resolution_mode: 'reply' | 'receipt';
  created_at: string;
  deadline_at: string;
  reminder_sent_count: number;
}

interface SendEmailNodeConfig {
  subject?: string;
  body?: unknown;
  reminder_count?: string;
  reminder_subject?: string;
  reminder_body?: unknown;
}

/** Fraction of the total created_at→deadline_at window that must have
 *  elapsed before reminder k (1-indexed) fires: 0.5, 0.75, 0.875, ... */
function thresholdFor(reminderIndex: number): number {
  return 1 - 0.5 ** reminderIndex;
}

/**
 * Atomically claims the next reminder slot via a compare-and-swap UPDATE
 * (`WHERE reminder_sent_count = <value just read>`). If a concurrent/retried
 * cron run already claimed it, this UPDATE affects zero rows and we skip
 * sending — the only guard against sending the same reminder twice.
 */
async function reserveNextReminder(
  followUp: EmailFollowUpRow,
  supabase: SupabaseClient,
): Promise<boolean> {
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;
  const { data } = await db
    .from('email_follow_ups')
    .update({
      reminder_sent_count: followUp.reminder_sent_count + 1,
      last_reminder_sent_at: new Date().toISOString(),
    })
    .eq('id', followUp.id)
    .eq('reminder_sent_count', followUp.reminder_sent_count)
    .select('id') as { data: { id: string }[] | null };

  return (data?.length ?? 0) > 0;
}

type FollowUpOutcome = 'sent' | 'overdue' | 'skipped';

async function processFollowUp(followUp: EmailFollowUpRow, supabase: SupabaseClient): Promise<FollowUpOutcome> {
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  if (!followUp.workflow_run_id) return 'skipped';

  const now = Date.now();
  const deadlineMs = new Date(followUp.deadline_at).getTime();

  if (now >= deadlineMs) {
    await db.from('email_follow_ups').update({ status: 'overdue' }).eq('id', followUp.id);
    return 'overdue';
  }

  const { data: run } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', followUp.workflow_run_id)
    .single() as { data: WorkflowRunRow | null };
  if (!run) return 'skipped';

  const { data: node } = await db
    .from('workflow_nodes')
    .select('config')
    .eq('template_id', run.template_id)
    .eq('node_id', followUp.node_id)
    .single() as { data: { config: SendEmailNodeConfig } | null };
  if (!node) return 'skipped';

  const cfg = node.config ?? {};
  const reminderCount = Number(cfg.reminder_count) || 1;
  if (followUp.reminder_sent_count >= reminderCount) return 'skipped';

  const createdMs = new Date(followUp.created_at).getTime();
  const totalDuration = deadlineMs - createdMs;
  if (totalDuration <= 0) return 'skipped';

  const elapsedFraction = (now - createdMs) / totalDuration;
  const nextReminderIndex = followUp.reminder_sent_count + 1;
  if (elapsedFraction < thresholdFor(nextReminderIndex)) return 'skipped';

  const reserved = await reserveNextReminder(followUp, supabase);
  if (!reserved) return 'skipped';

  const legalProcess = await fetchLegalProcess(followUp.legal_process_id, supabase);
  const clientData = await fetchClientData(followUp.legal_process_id, supabase);
  const context: ExecutionContext = { workflowRun: run, legalProcess, previousOutput: {}, clientData };

  const subject = substituteVars(cfg.reminder_subject || cfg.subject || '(Recordatorio)', context);
  const bodyHtml = substituteVars(resolveBodyHtml(cfg.reminder_body ?? cfg.body), context);

  await sendOrgEmail(followUp.organization_id, { to: followUp.to_email, subject, bodyHtml });
  return 'sent';
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  const { data: pendingFollowUps, error } = await db
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, node_id, to_email, resolution_mode, created_at, deadline_at, reminder_sent_count')
    .eq('status', 'pending') as { data: EmailFollowUpRow[] | null; error: { message: string } | null };

  if (error) {
    logger.error('Failed to load pending email follow-ups', undefined, { errorMessage: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = pendingFollowUps ?? [];
  let sent = 0;
  let overdue = 0;
  let failed = 0;

  for (const followUp of rows) {
    try {
      const outcome = await processFollowUp(followUp, supabase);
      if (outcome === 'sent') sent++;
      else if (outcome === 'overdue') overdue++;
    } catch (err) {
      failed++;
      logger.error('Failed to process email follow-up', err, { followUpId: followUp.id });
    }
  }

  logger.info('Email follow-ups cron run complete', { pending: rows.length, sent, overdue, failed });
  return NextResponse.json({ pending: rows.length, sent, overdue, failed });
}
