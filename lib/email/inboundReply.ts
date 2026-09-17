import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { getImapCredentials, getEmailProvider } from './connection';

/** Dirección Reply-To propia de Aurali para un correo que espera respuesta —
 *  usada por el nodo de workflow 'wait_email_reply' sin importar por qué
 *  proveedor salió el envío (SMTP/Google/Microsoft/Aurali): cuando el
 *  cliente responde, el mensaje llega siempre a un dominio que Aurali
 *  controla, nunca a la casilla propia de la organización. Requiere que
 *  INBOUND_EMAIL_DOMAIN tenga su MX apuntado a Resend Inbound. */
export function buildInboundReplyAddress(replyToken: string): string {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!domain) {
    throw new Error('INBOUND_EMAIL_DOMAIN no está configurado — no se puede armar la dirección de respuesta.');
  }
  return `reply+${replyToken}@${domain}`;
}

/** Extrae el reply_token del local-part `reply+{token}` de una dirección de
 *  destino del webhook — null si no matchea el patrón esperado. */
export function extractReplyToken(toAddress: string): string | null {
  const match = toAddress.match(/^reply\+([0-9a-f-]{36})@/i);
  return match?.[1] ?? null;
}

/** Message-ID determinístico para el modo capture_mode='imap' — el nodo lo
 *  fuerza al enviar (nodemailer lo soporta) y el poller IMAP busca este
 *  mismo valor dentro de In-Reply-To/References de los mensajes entrantes.
 *  No depende de ningún dominio especial: el correo sale con Reply-To
 *  normal (la dirección real de la organización), a diferencia del modo
 *  'webhook'. */
export function buildTrackingMessageId(replyToken: string): string {
  return `<${replyToken}@aurali-track>`;
}

/**
 * Decide cómo debe quedar rastreable un correo saliente que espera respuesta
 * — mismo criterio sin importar quién lo dispare: un nodo de workflow
 * (executeSendEmail/executeSendDocuments en lib/workflow/nodeExecutors.ts) o
 * una notificación manual (ej. avisar al cliente que un documento recibido
 * fue rechazado).
 *
 * Dos mecanismos soportados hoy:
 *   - 'imap': la organización conectó SMTP + IMAP en Ajustes → Correo — el
 *     poller abre su bandeja real (app/api/cron/email-inbound-imap-poll) y
 *     hace threading por Message-ID/In-Reply-To (buildTrackingMessageId).
 *   - 'google': la organización conectó Gmail vía OAuth — Gmail sobrescribe
 *     cualquier Message-ID propio, así que en vez de eso se guarda el
 *     threadId que la Gmail API devuelve al enviar (ver
 *     GoogleEmailService.send) y el mismo poller lee ese hilo con
 *     lib/email/gmail/gmailInboxClient.ts.
 *
 * El modo 'webhook' (Reply-To propio de Aurali + Resend Inbound) requiere
 * RESEND_INBOUND_WEBHOOK_SECRET/INBOUND_EMAIL_DOMAIN, que aún no están
 * configurados — hasta que lo estén, una organización sin IMAP ni Google no
 * puede rastrear respuestas (null) en vez de intentar un webhook roto que
 * tumbaría el envío del correo. El código del webhook
 * (app/api/webhooks/email-inbound/route.ts) y buildInboundReplyAddress más
 * abajo quedan listos para reactivarse: solo hay que volver a construir el
 * objeto con captureMode: 'webhook' acá cuando esas variables existan.
 */
export async function determineReplyCapture(
  organizationId: string | null,
): Promise<{ replyToken: string; captureMode: 'imap' | 'google' } | null> {
  if (!organizationId) return null;

  const imapCredentials = await getImapCredentials(organizationId);
  if (imapCredentials) return { replyToken: randomUUID(), captureMode: 'imap' };

  const provider = await getEmailProvider(organizationId);
  if (provider === 'google') return { replyToken: randomUUID(), captureMode: 'google' };

  return null;
}

/** Verifica la firma Svix de un webhook de Resend Inbound (mismo esquema que
 *  usan Resend/Clerk para sus webhooks: HMAC-SHA256 sobre
 *  `${svixId}.${svixTimestamp}.${rawBody}`, con el secreto en base64 tras el
 *  prefijo `whsec_`). Implementado a mano (sin el paquete `svix`) porque es
 *  un simple HMAC — evita sumar una dependencia nueva solo para esto.
 *  `svixSignature` puede traer varios valores separados por espacio
 *  ("v1,<base64> v1,<base64>..."), se acepta si alguno matchea. */
export function verifyInboundWebhookSignature(params: {
  rawBody: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
}): boolean {
  const { rawBody, svixId, svixTimestamp, svixSignature, secret } = params;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest();

  return svixSignature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)
    .some((candidate) => {
      try {
        const candidateBytes = Buffer.from(candidate, 'base64');
        return candidateBytes.length === expected.length && timingSafeEqual(candidateBytes, expected);
      } catch {
        return false;
      }
    });
}
