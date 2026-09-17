/**
 * POST /api/webhooks/gmail-push
 *
 * Endpoint de la push subscription de Cloud Pub/Sub — Gmail publica aquí
 * cada vez que cambia un mailbox con users.watch() activo (ver
 * lib/email/gmail/gmailWatch.ts). Reemplaza el polling de
 * capture_mode='google' que antes vivía en
 * app/api/cron/email-inbound-imap-poll: en vez de preguntar cada X tiempo,
 * Gmail nos avisa y de ahí pedimos solo el delta con users.history.list
 * (lib/email/gmail/gmailHistory.ts).
 *
 * Payload de Pub/Sub push (no de Gmail directamente):
 *   { message: { data: base64(JSON{emailAddress, historyId}), messageId, publishTime }, subscription }
 *
 * Seguridad: Pub/Sub firma un JWT OIDC en Authorization si la subscription
 * se configuró con autenticación habilitada (paso obligatorio del setup en
 * GCP) — se verifica contra las claves públicas de Google antes de confiar
 * en el payload. Sin GMAIL_PUSH_AUDIENCE configurado, se rechaza todo.
 */

import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { processGmailHistoryForOrg } from '@/lib/email/gmail/gmailPushProcessor';

export const dynamic = 'force-dynamic';

const logger = createLogger('WEBHOOK:GMAIL_PUSH');
const oauthClient = new OAuth2Client();

interface PubSubPushBody {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
}

async function verifyPubSubToken(request: Request): Promise<boolean> {
  const audience = process.env.GMAIL_PUSH_AUDIENCE;
  if (!audience) {
    logger.error('GMAIL_PUSH_AUDIENCE no está configurado — rechazando por seguridad');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return false;

  try {
    const ticket = await oauthClient.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    // Pub/Sub firma con la cuenta que se seleccionó al crear la subscription
    // (paso 4 del setup) — issuer siempre es Google, basta con que el token
    // sea válido y la audience coincida con nuestro endpoint.
    return Boolean(payload);
  } catch (err) {
    logger.error('Verificación de JWT de Pub/Sub falló', err);
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await verifyPubSubToken(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: PubSubPushBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const data = body.message?.data;
  if (!data) return NextResponse.json({ ok: true }); // ack — nada que procesar

  let notification: { emailAddress?: string; historyId?: string | number };
  try {
    notification = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
  } catch {
    logger.error('No se pudo decodificar el payload de Pub/Sub');
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }

  const emailAddress = notification.emailAddress;
  if (!emailAddress) return NextResponse.json({ ok: true });

  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as { from: (typeof supabase)['from'] };

  // Normalmente una sola organización por email conectado — pero nada impide
  // que la misma cuenta Google esté conectada a varias organizaciones (cada
  // una con su propio OAuth grant/token), así que se procesan todas: cada
  // fila lleva su propio historyId guardado, así que cada organización solo
  // ve el delta que le falta desde SU última sincronización.
  const { data: connections } = await db
    .from('email_connections')
    .select('organization_id')
    .eq('provider', 'google')
    .eq('status', 'connected')
    .eq('email', emailAddress) as { data: { organization_id: string }[] | null };

  let resolved = 0;
  for (const conn of connections ?? []) {
    try {
      const result = await processGmailHistoryForOrg(supabase, conn.organization_id);
      resolved += result.resolved;
    } catch (err) {
      logger.error('Error procesando el delta de Gmail para una organización', err, { organizationId: conn.organization_id });
    }
  }

  logger.info('Gmail push procesado', { emailAddress, organizations: connections?.length ?? 0, resolved });
  return NextResponse.json({ ok: true, resolved });
}
