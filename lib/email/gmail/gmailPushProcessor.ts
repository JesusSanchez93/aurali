import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';
import { fetchGmailHistoryAdditions } from './gmailHistory';
import { fetchGmailMessageParsed } from './gmailInboxClient';
import { getValidGoogleAccessToken } from '../providers/googleEmailService';
import { startOrRenewGmailWatch } from './gmailWatch';
import { resolveEmailReply, type PendingFollowUp } from '@/lib/workflow/emailReplyResolution';

const logger = createLogger('GMAIL_PUSH_PROCESSOR');

interface FollowUpRow extends PendingFollowUp {
  google_thread_id: string;
}

/**
 * Núcleo compartido por el webhook de Gmail Push (app/api/webhooks/gmail-push)
 * y la resincronización de respaldo (app/api/cron/gmail-watch-renew) — ambos
 * terminan aquí una vez que tienen accessToken + organizationId, la única
 * diferencia es quién los dispara (una notificación en tiempo real vs. un
 * barrido diario por si se perdió alguna). Idempotente: si un mensaje ya
 * resolvió su follow-up (status ya no es 'pending'), resolveEmailReply ni se
 * llama para ese thread — un reintento de Pub/Sub o un historyId reprocesado
 * no duplica nada.
 */
export async function processGmailHistoryForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ resolved: number }> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

  const { data: connection } = await db
    .from('email_connections')
    .select('google_watch_history_id')
    .eq('organization_id', organizationId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .maybeSingle() as { data: { google_watch_history_id: string | null } | null };

  if (!connection) return { resolved: 0 };

  const tokens = await getValidGoogleAccessToken(organizationId);
  if (!tokens) return { resolved: 0 };

  // Sin baseline todavía (watch nunca corrió para esta organización) — no hay
  // nada que diferenciar; el cron de renovación lo arrancará.
  if (!connection.google_watch_history_id) return { resolved: 0 };

  const delta = await fetchGmailHistoryAdditions(tokens.accessToken, connection.google_watch_history_id);

  if (!delta) {
    // El historyId salió de la ventana de retención de Gmail (~7 días sin
    // sincronizar) — no hay forma de recuperar el delta exacto. Se
    // re-establece el watch con un historyId fresco; los mensajes que
    // llegaron durante ese hueco quedan sin procesar (caso extremo: requiere
    // que el cron de renovación diaria haya fallado varios días seguidos).
    logger.error('historyId fuera de ventana — re-sincronizando desde cero', undefined, { organizationId });
    await startOrRenewGmailWatch(organizationId);
    return { resolved: 0 };
  }

  if (delta.additions.length === 0) {
    await db
      .from('email_connections')
      .update({ google_watch_history_id: delta.historyId })
      .eq('organization_id', organizationId)
      .eq('provider', 'google')
      .eq('status', 'connected');
    return { resolved: 0 };
  }

  const threadIds = [...new Set(delta.additions.map((a) => a.threadId))];
  const { data: pending } = await db
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, requires_attachments, google_thread_id')
    .eq('organization_id', organizationId)
    .eq('capture_mode', 'google')
    .eq('status', 'pending')
    .in('google_thread_id', threadIds) as { data: FollowUpRow[] | null };

  let resolved = 0;
  for (const followUp of pending ?? []) {
    const addition = delta.additions.find((a) => a.threadId === followUp.google_thread_id);
    if (!addition) continue;

    const message = await fetchGmailMessageParsed(tokens.accessToken, addition.messageId);
    if (!message) continue;

    const result = await resolveEmailReply(supabase, followUp, {
      from: message.from,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments,
    });
    if (result) resolved++;
  }

  await db
    .from('email_connections')
    .update({ google_watch_history_id: delta.historyId })
    .eq('organization_id', organizationId)
    .eq('provider', 'google')
    .eq('status', 'connected');

  return { resolved };
}
