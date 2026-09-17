/**
 * GET /api/cron/gmail-watch-renew
 *
 * Cron diario que reemplaza la rama 'google' del antiguo poller
 * (app/api/cron/email-inbound-imap-poll) por dos tareas de mantenimiento del
 * mecanismo push:
 *
 *   1. Renovar users.watch() para cada mailbox Google conectado — la
 *      expiración es de máx. 7 días (lib/email/gmail/gmailWatch.ts); correrlo
 *      1x/día deja margen amplio sin arriesgarse a que el watch expire y
 *      Gmail deje de publicar al topic de Pub/Sub.
 *   2. Resincronización de respaldo: procesa el mismo delta que procesaría el
 *      webhook (lib/email/gmail/gmailPushProcessor.ts) — Google recomienda
 *      esto explícitamente porque las notificaciones Pub/Sub son
 *      best-effort (una caída del webhook o un mensaje perdido no debe dejar
 *      una espera colgada hasta su deadline).
 *
 * Auth: mismo patrón que los demás crons — Vercel firma con
 * `Authorization: Bearer $CRON_SECRET` cuando CRON_SECRET está configurado.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { startOrRenewGmailWatch } from '@/lib/email/gmail/gmailWatch';
import { processGmailHistoryForOrg } from '@/lib/email/gmail/gmailPushProcessor';
import { createLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('CRON:GMAIL_WATCH_RENEW');

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

  const { data: connections, error } = await db
    .from('email_connections')
    .select('organization_id')
    .eq('provider', 'google')
    .eq('status', 'connected') as { data: { organization_id: string }[] | null; error: { message: string } | null };

  if (error) {
    logger.error('Failed to load connected Google mailboxes', undefined, { errorMessage: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let renewed = 0;
  let resolved = 0;
  let failed = 0;

  for (const conn of connections ?? []) {
    try {
      const watch = await startOrRenewGmailWatch(conn.organization_id);
      if (watch) renewed++;

      const result = await processGmailHistoryForOrg(supabase, conn.organization_id);
      resolved += result.resolved;
    } catch (err) {
      failed++;
      logger.error('Error renovando/resincronizando Gmail para una organización', err, { organizationId: conn.organization_id });
    }
  }

  logger.info('Gmail watch renew + recovery sync complete', {
    organizations: connections?.length ?? 0,
    renewed,
    resolved,
    failed,
  });
  return NextResponse.json({ organizations: connections?.length ?? 0, renewed, resolved, failed });
}
