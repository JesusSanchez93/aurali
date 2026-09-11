import { createLogger } from '@/lib/utils/logger';
import { getSmtpCredentials } from '../connection';
import { createSmtpTransport } from '../smtp/transport';
import type { EmailService, SendEmailParams, SendEmailResult } from '../types';

const logger = createLogger('SMTP_EMAIL');

/** Nodemailer attaches these to SMTP errors — logger.error() strips them, so pull them out separately for the server log. */
function smtpErrorDiagnostics(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== 'object') return {};
  const { code, responseCode, command } = err as { code?: string; responseCode?: number; command?: string };
  return { code, responseCode, command };
}

/** Sends through the organization's own SMTP server via Nodemailer. */
export class SmtpEmailService implements EmailService {
  readonly provider = 'smtp' as const;

  constructor(private readonly organizationId: string) {}

  async send({ to, subject, html, attachments, replyTo }: SendEmailParams): Promise<SendEmailResult> {
    const credentials = await getSmtpCredentials(this.organizationId);
    if (!credentials) {
      throw new Error('No hay una configuración SMTP conectada para esta organización.');
    }

    const transport = await createSmtpTransport(credentials);
    try {
      const from = credentials.fromName
        ? `${credentials.fromName} <${credentials.fromEmail}>`
        : credentials.fromEmail;

      const info = await transport.sendMail({
        from,
        to,
        subject,
        html,
        replyTo,
        attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content })),
      });

      return { id: info.messageId ?? null, provider: this.provider };
    } catch (err) {
      logger.error('SMTP send failed', err, {
        organizationId: this.organizationId,
        subject,
        ...smtpErrorDiagnostics(err),
      });
      // Keep the underlying message (not just a generic wrapper) — callers
      // like sendSmtpTestEmail() pattern-match on it to show a specific,
      // user-friendly reason (auth vs. connection vs. TLS) instead of this
      // raw string, which never reaches the browser directly.
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Error al enviar email a ${to} vía SMTP: ${detail}`);
    } finally {
      transport.close();
    }
  }
}
