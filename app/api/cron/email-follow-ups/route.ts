/**
 * GET /api/cron/email-follow-ups
 *
 * Invoked hourly by Vercel Cron (see vercel.json). Scans email_follow_ups
 * rows created by trackFollowUpIfEnabled (lib/workflow/nodeExecutors.ts)
 * whose deadline has passed and are still `status = 'pending'`:
 *
 *   - If the send_email node's reminder_count hasn't been reached yet,
 *     sends one more reminder (reminder_subject/reminder_body from the
 *     node's config) and pushes deadline_at forward by another
 *     follow_up_value/follow_up_unit interval.
 *   - Otherwise marks the row `status = 'overdue'` — resolution then
 *     depends on resolution_mode ('reply' has no inbound-email detection
 *     yet; 'receipt' is resolved separately by signature-actions.ts when
 *     the lawyer approves the client's documents).
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
  deadline_at: string;
  reminder_sent_count: number;
}

interface SendEmailNodeConfig {
  subject?: string;
  body?: unknown;
  follow_up_value?: string;
  follow_up_unit?: string;
  reminder_count?: string;
  reminder_subject?: string;
  reminder_body?: unknown;
}

function nextDeadline(cfg: SendEmailNodeConfig): string {
  const amount = Number(cfg.follow_up_value) || 24;
  const unitMs = cfg.follow_up_unit === 'days' ? 1000 * 60 * 60 * 24 : 1000 * 60 * 60;
  return new Date(Date.now() + amount * unitMs).toISOString();
}

async function processFollowUp(followUp: EmailFollowUpRow, supabase: SupabaseClient): Promise<void> {
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  if (!followUp.workflow_run_id) return;

  const { data: run } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', followUp.workflow_run_id)
    .single() as { data: WorkflowRunRow | null };
  if (!run) return;

  const { data: node } = await db
    .from('workflow_nodes')
    .select('config')
    .eq('template_id', run.template_id)
    .eq('node_id', followUp.node_id)
    .single() as { data: { config: SendEmailNodeConfig } | null };
  if (!node) return;

  const cfg = node.config ?? {};
  const reminderCount = Number(cfg.reminder_count) || 1;

  if (followUp.reminder_sent_count >= reminderCount) {
    await db.from('email_follow_ups').update({ status: 'overdue' }).eq('id', followUp.id);
    return;
  }

  const legalProcess = await fetchLegalProcess(followUp.legal_process_id, supabase);
  const clientData = await fetchClientData(followUp.legal_process_id, supabase);
  const context: ExecutionContext = { workflowRun: run, legalProcess, previousOutput: {}, clientData };

  const subject = substituteVars(cfg.reminder_subject || cfg.subject || '(Recordatorio)', context);
  const bodyHtml = substituteVars(resolveBodyHtml(cfg.reminder_body ?? cfg.body), context);

  await sendOrgEmail(followUp.organization_id, { to: followUp.to_email, subject, bodyHtml });

  await db
    .from('email_follow_ups')
    .update({
      reminder_sent_count: followUp.reminder_sent_count + 1,
      last_reminder_sent_at: new Date().toISOString(),
      deadline_at: nextDeadline(cfg),
    })
    .eq('id', followUp.id);
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

  const { data: dueFollowUps, error } = await db
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, node_id, to_email, resolution_mode, deadline_at, reminder_sent_count')
    .eq('status', 'pending')
    .lte('deadline_at', new Date().toISOString()) as { data: EmailFollowUpRow[] | null; error: { message: string } | null };

  if (error) {
    logger.error('Failed to load due email follow-ups', undefined, { errorMessage: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = dueFollowUps ?? [];
  let processed = 0;
  let failed = 0;

  for (const followUp of rows) {
    try {
      await processFollowUp(followUp, supabase);
      processed++;
    } catch (err) {
      failed++;
      logger.error('Failed to process email follow-up', err, { followUpId: followUp.id });
    }
  }

  logger.info('Email follow-ups cron run complete', { due: rows.length, processed, failed });
  return NextResponse.json({ due: rows.length, processed, failed });
}
