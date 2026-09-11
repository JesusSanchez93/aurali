import { createClient } from '@/lib/supabase/server';
import { decryptSecret } from './crypto';
import type { EmailConnectionInfo, EmailProvider, SmtpSecurity } from './types';

interface RawConnection {
  provider: string;
  email: string;
  display_name: string | null;
  status: string;
  error_message: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  updated_at: string;
}

const RAW_CONNECTION_COLUMNS =
  'provider, email, display_name, status, error_message, access_token, refresh_token, token_expires_at, ' +
  'smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, updated_at';

/**
 * Reads the organization's active (or most recent) email connection using the
 * service-role client — tokens and the SMTP password are sensitive and must
 * never round-trip through a browser session, so this always bypasses RLS
 * deliberately rather than relying on the caller's cookie-scoped session.
 * (The anon/authenticated roles can't select these columns at all — see
 * migration 20260908130000 — this is the belt to that suspenders.)
 */
async function getRawConnection(organizationId: string): Promise<RawConnection | null> {
  const supabase = await createClient({ admin: true });
  const { data, error } = await supabase
    .from('email_connections')
    .select(RAW_CONNECTION_COLUMNS)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RawConnection | null;
}

/**
 * Determines which email provider an organization should use.
 *
 *   org has a connected external account?  -> 'google' | 'microsoft' | 'smtp'
 *   otherwise                              -> 'aurali' (internal fallback)
 */
export async function getEmailProvider(organizationId: string): Promise<EmailProvider> {
  const connection = await getRawConnection(organizationId);
  if (connection && connection.status === 'connected') {
    return connection.provider as EmailProvider;
  }
  return 'aurali';
}

/** Safe-to-render connection state for the settings UI — never includes tokens or the SMTP password. */
export async function getEmailConnectionInfo(organizationId: string): Promise<EmailConnectionInfo> {
  const connection = await getRawConnection(organizationId);

  if (!connection || connection.status !== 'connected') {
    return {
      provider: 'aurali',
      email: process.env.AURALI_DEFAULT_FROM_EMAIL ?? 'notificaciones@aurali.app',
      displayName: null,
      status: connection?.status === 'error' ? 'error' : 'disconnected',
      errorMessage: connection?.error_message ?? null,
      connectedAt: null,
      smtp: null,
    };
  }

  const isSmtp = connection.provider === 'smtp';

  return {
    provider: connection.provider as EmailProvider,
    email: connection.email,
    displayName: connection.display_name,
    status: 'connected',
    errorMessage: null,
    connectedAt: connection.updated_at,
    smtp:
      isSmtp && connection.smtp_host && connection.smtp_port && connection.smtp_username
        ? {
            host: connection.smtp_host,
            port: connection.smtp_port,
            security: (connection.smtp_security as SmtpSecurity) ?? 'starttls',
            username: connection.smtp_username,
          }
        : null,
  };
}

/**
 * Demotes any currently-connected connection for an org and scrubs its
 * secrets (OAuth tokens / SMTP password) — used before activating a new
 * provider so a superseded connection never leaves live credentials behind,
 * whether it's replaced via OAuth callback or via the SMTP save action.
 */
export async function demoteActiveConnection(organizationId: string): Promise<void> {
  const supabase = await createClient({ admin: true });
  const { error } = await supabase
    .from('email_connections')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      smtp_password_encrypted: null,
    })
    .eq('organization_id', organizationId)
    .eq('status', 'connected');

  if (error) throw new Error(error.message);
}

/** Internal — only for use inside lib/email/providers, never expose tokens beyond this module. */
export async function getConnectionTokens(organizationId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null;
} | null> {
  const connection = await getRawConnection(organizationId);
  if (!connection || connection.status !== 'connected' || !connection.access_token || !connection.refresh_token) {
    return null;
  }
  return {
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
    expiresAt: connection.token_expires_at,
  };
}

/** Internal — only for use inside lib/email/providers/smtpEmailService.ts. Decrypts the password on read, never caches it. */
export async function getSmtpCredentials(organizationId: string): Promise<{
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
} | null> {
  const connection = await getRawConnection(organizationId);
  if (
    !connection ||
    connection.status !== 'connected' ||
    connection.provider !== 'smtp' ||
    !connection.smtp_host ||
    !connection.smtp_port ||
    !connection.smtp_username ||
    !connection.smtp_password_encrypted
  ) {
    return null;
  }

  return {
    host: connection.smtp_host,
    port: connection.smtp_port,
    security: (connection.smtp_security as SmtpSecurity) ?? 'starttls',
    username: connection.smtp_username,
    password: decryptSecret(connection.smtp_password_encrypted),
    fromEmail: connection.email,
    fromName: connection.display_name,
  };
}
