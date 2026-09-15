/**
 * POST /api/webhooks/email-inbound
 *
 * Recibe la respuesta de un cliente a un correo enviado por el nodo de
 * workflow 'wait_email_reply' (lib/workflow/nodeExecutors.ts) cuando la
 * organización está en capture_mode='webhook' (no configuró IMAP) — el
 * correo saliente en ese modo lleva un Reply-To propio de Aurali
 * (reply+{token}@INBOUND_EMAIL_DOMAIN, ver lib/email/inboundReply.ts) sin
 * importar por qué proveedor salió — así la respuesta siempre llega acá, vía
 * Resend Inbound, en vez de a la casilla de la organización. Para
 * organizaciones con capture_mode='imap', la respuesta se detecta en cambio
 * vía app/api/cron/email-inbound-imap-poll (lectura real de su bandeja) —
 * ambos casos comparten la misma lógica de resolución en
 * lib/workflow/emailReplyResolution.ts.
 *
 * Flujo:
 *   1. Verifica la firma Svix del webhook (RESEND_INBOUND_WEBHOOK_SECRET).
 *   2. Extrae el reply_token del destinatario y busca la fila pendiente en
 *      email_follow_ups (capture_mode='webhook').
 *   3. Delega en resolveEmailReply() — sube adjuntos, notifica al abogado,
 *      marca el seguimiento resuelto y reanuda el workflow (o no hace nada
 *      si requires_attachments está activo y no trae adjuntos).
 *
 * NOTA: la forma exacta del payload de Resend Inbound (nombres de campos,
 * si los adjuntos vienen en base64 o por URL) debe confirmarse contra la
 * documentación vigente de Resend antes de salir a producción — parseInboundPayload()
 * concentra ese parseo para que sea fácil de ajustar sin tocar el resto del handler.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractReplyToken, verifyInboundWebhookSignature } from '@/lib/email/inboundReply';
import { resolveEmailReply, type PendingFollowUp } from '@/lib/workflow/emailReplyResolution';
import { createLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('WEBHOOK:EMAIL_INBOUND');

interface InboundAttachment {
  filename: string;
  contentType: string | null;
  content: Buffer;
}

interface InboundPayload {
  to: string;
  from: string;
  subject: string;
  text: string | null;
  attachments: InboundAttachment[];
}

/** Concentra el parseo del payload de Resend Inbound — ver nota arriba. */
function parseInboundPayload(json: unknown): InboundPayload | null {
  const data = (json as { data?: Record<string, unknown> })?.data ?? (json as Record<string, unknown>);
  if (!data || typeof data !== 'object') return null;

  const to = Array.isArray(data.to) ? String(data.to[0]) : String(data.to ?? '');
  const from = String(data.from ?? '');
  const subject = String(data.subject ?? '');
  const text = typeof data.text === 'string' ? data.text : null;

  const rawAttachments = Array.isArray(data.attachments) ? data.attachments : [];
  const attachments: InboundAttachment[] = [];
  for (const a of rawAttachments as Record<string, unknown>[]) {
    const contentRaw = a.content;
    if (typeof contentRaw !== 'string') continue;
    try {
      attachments.push({
        filename: String(a.filename ?? 'adjunto'),
        contentType: typeof a.content_type === 'string' ? a.content_type : null,
        content: Buffer.from(contentRaw, 'base64'),
      });
    } catch {
      // Adjunto malformado — se ignora, no bloquea el resto del correo.
    }
  }

  if (!to) return null;
  return { to, from, subject, text, attachments };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('RESEND_INBOUND_WEBHOOK_SECRET no configurado', undefined, {});
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Faltan headers de firma' }, { status: 400 });
  }

  const validSignature = verifyInboundWebhookSignature({
    rawBody, svixId, svixTimestamp, svixSignature, secret,
  });

  if (!validSignature) {
    logger.error('Firma de webhook inválida', undefined, { svixId });
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const payload = parseInboundPayload(JSON.parse(rawBody));
  if (!payload) {
    return NextResponse.json({ error: 'Payload no reconocido' }, { status: 400 });
  }

  const replyToken = extractReplyToken(payload.to);
  if (!replyToken) {
    // No es una respuesta a ningún nodo wait_email_reply — se descarta en silencio.
    return NextResponse.json({ ok: true, matched: false });
  }

  const supabase = await createClient({ admin: true });
  const db = supabase as typeof supabase & Record<string, unknown>;

  const { data: followUp } = await db
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, requires_attachments, status')
    .eq('reply_token', replyToken)
    .eq('capture_mode', 'webhook')
    .eq('status', 'pending')
    .maybeSingle() as { data: (PendingFollowUp & { status: string }) | null };

  if (!followUp) {
    logger.info('reply_token sin match (ya resuelto o inexistente)', { replyToken });
    return NextResponse.json({ ok: true, matched: false });
  }

  const result = await resolveEmailReply(supabase, followUp, {
    from: payload.from,
    subject: payload.subject,
    text: payload.text,
    attachments: payload.attachments,
  });

  if (!result) {
    return NextResponse.json({ ok: true, matched: true, waiting: true });
  }

  return NextResponse.json({ ok: true, matched: true, attachments: result.attachmentIds.length });
}
