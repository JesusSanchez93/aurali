import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { getValidGoogleAccessToken } from '../providers/googleEmailService';

const logger = createLogger('GMAIL_WATCH');

const GMAIL_WATCH_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/watch';

/**
 * Registra (o renueva) el users.watch() de Gmail para el mailbox conectado
 * de una organización — sin esto, Gmail nunca publica al topic de Pub/Sub.
 * expiration es de máx. 7 días desde la llamada; el caller (cron
 * app/api/cron/gmail-watch-renew) debe invocar esto periódicamente, no solo
 * al conectar. Guarda el historyId devuelto como baseline: tanto el webhook
 * como la resincronización de respaldo parten de ahí para pedir solo el
 * delta vía users.history.list — no releen el mailbox completo.
 */
export async function startOrRenewGmailWatch(organizationId: string): Promise<{ historyId: string; expiration: Date } | null> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    logger.error('GOOGLE_PUBSUB_TOPIC no está configurado — no se puede registrar el watch', undefined, { organizationId });
    return null;
  }

  const tokens = await getValidGoogleAccessToken(organizationId);
  if (!tokens) return null;

  const res = await fetch(GMAIL_WATCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX'],
      labelFilterAction: 'include',
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    logger.error('Gmail users.watch falló', undefined, { organizationId, status: res.status, detail });
    return null;
  }

  const data = (await res.json()) as { historyId: string; expiration: string };
  const expiration = new Date(Number(data.expiration));

  const supabase = await createClient({ admin: true });
  const { error } = await supabase
    .from('email_connections')
    .update({ google_watch_history_id: data.historyId, google_watch_expiration: expiration.toISOString() })
    .eq('organization_id', organizationId)
    .eq('provider', 'google')
    .eq('status', 'connected');

  if (error) {
    logger.error('No se pudo guardar el estado del watch', undefined, { organizationId, errorMessage: error.message });
  }

  return { historyId: data.historyId, expiration };
}
