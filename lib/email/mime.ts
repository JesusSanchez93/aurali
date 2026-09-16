import { randomBytes } from 'crypto';
import type { EmailAttachment } from './types';

/** RFC 2047 encoded-word — needed because Subject headers must stay ASCII. */
function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface RawMessageParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Builds an RFC 2822 message and base64url-encodes it for the Gmail API's
 * `users.messages.send` `raw` field.
 */
export function buildRawGmailMessage({ from, to, subject, html, replyTo, attachments }: RawMessageParams): string {
  const headers = [`From: ${from}`, `To: ${to}`, `Subject: ${encodeSubject(subject)}`, 'MIME-Version: 1.0'];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  let body: string;
  if (attachments && attachments.length > 0) {
    const boundary = `aurali_${randomBytes(12).toString('hex')}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts = [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64'),
      ...attachments.flatMap((a) => [
        `--${boundary}`,
        `Content-Type: application/octet-stream; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        a.content.toString('base64'),
      ]),
      `--${boundary}--`,
    ];
    body = parts.join('\r\n');
  } else {
    headers.push('Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64');
    body = Buffer.from(html, 'utf8').toString('base64');
  }

  return base64url(`${headers.join('\r\n')}\r\n\r\n${body}`);
}
