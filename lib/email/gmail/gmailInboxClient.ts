import { simpleParser, type ParsedMail } from 'mailparser';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailInboundMessage {
  from: string;
  subject: string;
  text: string | null;
  receivedAt: Date | null;
  attachments: { filename: string; contentType: string | null; content: Buffer }[];
}

/**
 * Descarga y parsea un mensaje puntual de Gmail por su id — usado por
 * gmailPushProcessor.ts una vez que users.history.list (gmailHistory.ts) ya
 * identificó qué messageId es una respuesta nueva en INBOX. format='raw' +
 * mailparser reutiliza el mismo parser que lib/email/imap/imapClient.ts para
 * que resolveEmailReply no distinga IMAP de Gmail.
 */
export async function fetchGmailMessageParsed(accessToken: string, messageId: string): Promise<GmailInboundMessage | null> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=raw`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const { raw } = (await res.json()) as { raw?: string };
  if (!raw) return null;

  const buffer = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const parsed: ParsedMail = await simpleParser(buffer);

  return {
    from: parsed.from?.text ?? '',
    subject: parsed.subject ?? '',
    text: parsed.text ?? null,
    receivedAt: parsed.date ?? null,
    attachments: parsed.attachments.map((a) => ({
      filename: a.filename ?? 'adjunto',
      contentType: a.contentType ?? null,
      content: a.content,
    })),
  };
}
