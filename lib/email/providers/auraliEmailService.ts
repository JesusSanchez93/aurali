import { resend } from '@/lib/resend';
import { createLogger } from '@/lib/utils/logger';
import type { EmailService, SendEmailParams, SendEmailResult } from '../types';

const logger = createLogger('AURALI_EMAIL');

const DEFAULT_FROM = process.env.AURALI_DEFAULT_FROM_EMAIL ?? 'notificaciones@aurali.app';

/** Sends through Aurali's own Resend account — the always-available fallback. */
export class AuraliEmailService implements EmailService {
  readonly provider = 'aurali' as const;

  async send({ to, subject, html, attachments, replyTo }: SendEmailParams): Promise<SendEmailResult> {
    const { data, error } = await resend.emails.send({
      from: `Aurali <${DEFAULT_FROM}>`,
      to,
      subject,
      html,
      attachments,
      replyTo,
    });

    if (error) {
      logger.error('Resend email failed', undefined, { subject, errorMessage: error.message });
      throw new Error(`Error al enviar email a ${to}: ${error.message}`);
    }

    return { id: data?.id ?? null, provider: this.provider };
  }
}
