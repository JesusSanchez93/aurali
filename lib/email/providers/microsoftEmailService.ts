import { getConnectionTokens } from '../connection';
import type { EmailService, SendEmailResult } from '../types';

/**
 * Sends through the organization's connected Microsoft 365 / Outlook account
 * via Microsoft Graph.
 *
 * Not implemented yet — connecting an account only stores the OAuth tokens
 * (see app/api/auth/email/microsoft/). Actual sending requires calling
 * `POST /me/sendMail` against Graph, left for a follow-up once an org
 * depends on it.
 */
export class MicrosoftEmailService implements EmailService {
  readonly provider = 'microsoft' as const;

  constructor(private readonly organizationId: string) {}

  async send(): Promise<SendEmailResult> {
    const tokens = await getConnectionTokens(this.organizationId);
    if (!tokens) {
      throw new Error('No hay una cuenta de Microsoft conectada para esta organización.');
    }
    throw new Error(
      'El envío de correo vía Microsoft Graph aún no está implementado. Conecta la cuenta y usa AuraliEmailService mientras tanto.',
    );
  }
}
