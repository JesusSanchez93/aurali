/**
 * GET /api/cron/email-inbound-imap-poll
 *
 * Contraparte de app/api/webhooks/email-inbound para organizaciones con
 * capture_mode='imap' (SMTP + campos IMAP configurados en Ajustes → Email —
 * ver lib/email/connection.ts:getImapCredentials): en vez de esperar un
 * webhook, este cron abre la bandeja real de cada organización con una
 * espera pendiente y busca respuestas por threading (Message-ID forzado al
 * enviar, ver lib/email/inboundReply.ts:buildTrackingMessageId, encontrado
 * en In-Reply-To/References del mensaje entrante).
 *
 * Una conexión IMAP por organización (no por fila pendiente) — se agrupan
 * las filas pendientes antes de conectar. Un fallo de credenciales/conexión
 * en una organización no debe tumbar el resto del lote.
 *
 * Auth: mismo patrón que email-follow-ups — Vercel firma con
 * `Authorization: Bearer $CRON_SECRET` cuando CRON_SECRET está configurado.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getImapCredentials } from '@/lib/email/connection';
import { createImapClient, fetchMessagesSince } from '@/lib/email/imap/imapClient';
import { buildTrackingMessageId } from '@/lib/email/inboundReply';
import { resolveEmailReply, type PendingFollowUp } from '@/lib/workflow/emailReplyResolution';
import { createLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('CRON:EMAIL_INBOUND_IMAP_POLL');

interface FollowUpRow extends PendingFollowUp {
  reply_token: string;
  created_at: string;
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

  const { data: pending, error } = await db
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, requires_attachments, reply_token, created_at')
    .eq('status', 'pending')
    .eq('capture_mode', 'imap') as { data: FollowUpRow[] | null; error: { message: string } | null };

  if (error) {
    logger.error('Failed to load pending IMAP follow-ups', undefined, { errorMessage: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = pending ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ organizations: 0, resolved: 0, failed: 0 });
  }

  const byOrg = new Map<string, FollowUpRow[]>();
  for (const row of rows) {
    const list = byOrg.get(row.organization_id) ?? [];
    list.push(row);
    byOrg.set(row.organization_id, list);
  }

  let resolved = 0;
  let failed = 0;

  for (const [organizationId, followUps] of byOrg) {
    try {
      const credentials = await getImapCredentials(organizationId);
      if (!credentials) {
        // Se desconfiguró el IMAP después de crear la espera — no hay nada
        // que hacer salvo esperar a que venza (deadline_at), igual que si
        // nunca hubiera respondido.
        continue;
      }

      const oldestCreatedAt = followUps.reduce(
        (min, f) => (f.created_at < min ? f.created_at : min),
        followUps[0].created_at,
      );

      const client = await createImapClient(credentials);
      try {
        const messages = await fetchMessagesSince(client, new Date(oldestCreatedAt));

        for (const followUp of followUps) {
          const trackingId = buildTrackingMessageId(followUp.reply_token);
          const match = messages.find((m) => m.referenceIds.includes(trackingId));
          if (!match) continue;

          const result = await resolveEmailReply(supabase, followUp, {
            from: match.from,
            subject: match.subject,
            text: match.text,
            attachments: match.attachments,
          });
          if (result) resolved++;
        }
      } finally {
        await client.logout();
      }
    } catch (err) {
      failed++;
      logger.error('Error al sondear IMAP de una organización', err, { organizationId });
    }
  }

  logger.info('IMAP inbound poll complete', { organizations: byOrg.size, resolved, failed });
  return NextResponse.json({ organizations: byOrg.size, resolved, failed });
}
