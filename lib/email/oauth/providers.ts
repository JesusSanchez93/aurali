export type OAuthEmailProvider = 'google' | 'microsoft';

interface OAuthProviderConfig {
  clientId: string | undefined;
  clientSecret: string | undefined;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Extra authorize-request params beyond client_id/redirect_uri/scope/state. */
  extraAuthorizeParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<OAuthEmailProvider, OAuthProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email https://www.googleapis.com/auth/gmail.send',
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authorizeUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/token`,
    scope: 'openid email offline_access Mail.Send',
  },
};

export function isOAuthEmailProvider(value: string): value is OAuthEmailProvider {
  return value === 'google' || value === 'microsoft';
}

export function getRedirectUri(provider: OAuthEmailProvider): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/api/auth/email/${provider}/callback`;
}

/**
 * Exchanges a stored refresh token for a fresh access token — used by
 * GoogleEmailService/MicrosoftEmailService right before sending once the
 * cached access token is at or past expiry. Returns null on failure (e.g. the
 * refresh token was revoked); callers should surface a reconnect prompt.
 */
export async function refreshAccessToken(
  provider: OAuthEmailProvider,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string } | null> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config.clientId || !config.clientSecret) return null;

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}
