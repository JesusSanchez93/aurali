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
