import { getConnectionTokens } from '../connection';
import type { EmailService, SendEmailResult } from '../types';

/**
 * Sends through the organization's connected Gmail / Google Workspace
 * account via the Gmail API.
 *
 * Not implemented yet — connecting an account only stores the OAuth tokens
 * (see app/api/auth/email/google/). Actual sending requires building the
 * MIME message and calling `users.messages.send`, which is left for a
 * follow-up once an org depends on it.
 */
export class GoogleEmailService implements EmailService {
  readonly provider = 'google' as const;

  constructor(private readonly organizationId: string) {}

  async send(): Promise<SendEmailResult> {
    const tokens = await getConnectionTokens(this.organizationId);
    if (!tokens) {
      throw new Error('No hay una cuenta de Google conectada para esta organización.');
    }
    throw new Error(
      'El envío de correo vía Gmail API aún no está implementado. Conecta la cuenta y usa AuraliEmailService mientras tanto.',
    );
  }
}
