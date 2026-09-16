import { createLogger } from '@/lib/utils/logger';
import { getConnectionTokens, updateConnectionAccessToken } from '../connection';
import { refreshAccessToken } from '../oauth/providers';
import { buildRawGmailMessage } from '../mime';
import type { EmailService, SendEmailParams, SendEmailResult } from '../types';

const logger = createLogger('GOOGLE_EMAIL');

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
/** Refresh a little before the stored expiry to avoid a send racing an in-flight token. */
const TOKEN_REFRESH_BUFFER_MS = 60_000;

/** Sends through the organization's connected Gmail / Google Workspace account via the Gmail API. */
export class GoogleEmailService implements EmailService {
  readonly provider = 'google' as const;

  constructor(private readonly organizationId: string) {}

  private async getAccessToken(): Promise<{ accessToken: string; email: string; displayName: string | null }> {
    const tokens = await getConnectionTokens(this.organizationId);
    if (!tokens) {
      throw new Error('No hay una cuenta de Google conectada para esta organización.');
    }

    const expiresAtMs = tokens.expiresAt ? new Date(tokens.expiresAt).getTime() : 0;
    if (expiresAtMs - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
      return { accessToken: tokens.accessToken, email: tokens.email, displayName: tokens.displayName };
    }

    const refreshed = await refreshAccessToken('google', tokens.refreshToken);
    if (!refreshed) {
      throw new Error('No pudimos renovar el acceso a la cuenta de Google. Reconéctala en Ajustes → Correo.');
    }
    await updateConnectionAccessToken(this.organizationId, 'google', refreshed.accessToken, refreshed.expiresAt);
    return { accessToken: refreshed.accessToken, email: tokens.email, displayName: tokens.displayName };
  }

  async send({ to, subject, html, attachments, replyTo }: SendEmailParams): Promise<SendEmailResult> {
    const { accessToken, email, displayName } = await this.getAccessToken();
    const from = displayName ? `${displayName} <${email}>` : email;
    // Gmail assigns its own Message-ID regardless of what's set here — unlike
    // SMTP, there's no way to force one (see SendEmailParams.messageId).
    const raw = buildRawGmailMessage({ from, to, subject, html, replyTo, attachments });

    const res = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const detail = await res.text();
      logger.error('Gmail API send failed', undefined, { organizationId: this.organizationId, status: res.status, detail });
      throw new Error(`Error al enviar email a ${to} vía Gmail (HTTP ${res.status}).`);
    }

    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? null, provider: this.provider };
  }
}
