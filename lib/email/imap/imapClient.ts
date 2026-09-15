import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import type { SmtpSecurity } from '../types';

export interface ImapCredentials {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
}

export interface ParsedInboundMessage {
  from: string;
  subject: string;
  text: string | null;
  /** Concatena References + In-Reply-To — basta con que contenga el
   *  Message-ID que buscamos, sin importar en cuál de los dos vino. */
  referenceIds: string;
  attachments: { filename: string; contentType: string | null; content: Buffer }[];
}

/** Abre una sesión IMAP de un solo uso — igual criterio que
 *  createSmtpTransport: nunca se mantiene viva entre invocaciones
 *  serverless, el llamador debe cerrarla (`logout()`) al terminar. */
export async function createImapClient(credentials: ImapCredentials): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.security === 'ssl_tls',
    auth: { user: credentials.username, pass: credentials.password },
    logger: false,
  });
  await client.connect();
  return client;
}

/** Lista y parsea los mensajes de INBOX recibidos desde `since` — un solo
 *  fetch completo por mensaje (vía `download` + `simpleParser`) en vez de
 *  reconstruir headers/adjuntos a mano.
 *
 *  El criterio SINCE de IMAP solo tiene granularidad de día (sin hora) y el
 *  servidor lo evalúa contra SU PROPIO huso horario — si este proceso corre
 *  en un huso horario negativo (América), el día en UTC ya cambió varias
 *  horas antes que el día del servidor, y un SINCE armado con la fecha UTC
 *  exacta excluye en silencio todo el correo de "hoy" según el servidor. Por
 *  eso el SINCE que se manda ensancha un día extra hacia atrás (barato: solo
 *  trae algunos mensajes de más, nunca de menos) y el filtro preciso —
 *  comparando la fecha real del mensaje contra `since`— se hace en JS. */
export async function fetchMessagesSince(client: ImapFlow, since: Date): Promise<ParsedInboundMessage[]> {
  const lock = await client.getMailboxLock('INBOX');
  const messages: ParsedInboundMessage[] = [];

  try {
    const searchSince = new Date(since.getTime() - 24 * 60 * 60 * 1000);
    const uids = await client.search({ since: searchSince }, { uid: true });
    if (!uids || uids.length === 0) return [];

    for (const uid of uids) {
      const { content } = await client.download(String(uid), undefined, { uid: true });
      const parsed: ParsedMail = await simpleParser(content);

      if (parsed.date && parsed.date < since) continue;

      const referenceIds = [
        parsed.inReplyTo ?? '',
        Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references ?? '',
      ].join(' ');

      messages.push({
        from: parsed.from?.text ?? '',
        subject: parsed.subject ?? '',
        text: parsed.text ?? null,
        referenceIds,
        attachments: parsed.attachments.map((a) => ({
          filename: a.filename ?? 'adjunto',
          contentType: a.contentType ?? null,
          content: a.content,
        })),
      });
    }
  } finally {
    lock.release();
  }

  return messages;
}
