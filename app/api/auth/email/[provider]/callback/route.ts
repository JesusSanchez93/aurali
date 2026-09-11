/**
 * GET /api/auth/email/[provider]/callback
 *
 * Exchanges the OAuth authorization code for tokens, resolves the connected
 * mailbox address, and stores the connection for the organization that
 * started the flow (read from the signed state cookie set in /connect —
 * never from a request parameter).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { demoteActiveConnection } from '@/lib/email/connection';
import { OAUTH_PROVIDERS, getRedirectUri, isOAuthEmailProvider } from '@/lib/email/oauth/providers';
import { OAUTH_STATE_COOKIE } from '../connect/route';

const logger = createLogger('API:EMAIL_OAUTH_CALLBACK');

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function fetchConnectedEmail(provider: 'google' | 'microsoft', accessToken: string): Promise<string | null> {
  if (provider === 'google') {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params;
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  const code = request.nextUrl.searchParams.get('code');
  const returnedState = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');

  let locale = 'es';
  const failTo = (reason: string) => {
    return NextResponse.redirect(new URL(`/${locale}/settings/email?email_error=${reason}`, request.url));
  };

  if (!isOAuthEmailProvider(rawProvider)) return failTo('unsupported_provider');
  const provider = rawProvider;

  if (!stateCookie) return failTo('missing_state');

  let parsed: { state: string; orgId: string; locale: string; provider: string };
  try {
    parsed = JSON.parse(stateCookie);
  } catch {
    return failTo('invalid_state');
  }
  locale = parsed.locale || 'es';

  if (oauthError) return failTo('access_denied');
  if (!code || !returnedState || returnedState !== parsed.state || parsed.provider !== provider) {
    return failTo('invalid_state');
  }

  const config = OAUTH_PROVIDERS[provider];
  if (!config.clientId || !config.clientSecret) return failTo('not_configured');

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: getRedirectUri(provider),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      logger.error('OAuth token exchange failed', undefined, { provider, status: tokenRes.status });
      return failTo('token_exchange_failed');
    }

    const tokens = (await tokenRes.json()) as TokenResponse;
    const email = await fetchConnectedEmail(provider, tokens.access_token);
    if (!email) return failTo('no_email_scope');

    // Only one 'connected' row per org (enforced by a partial unique index) —
    // demote any existing connection (and scrub its secrets) before inserting.
    await demoteActiveConnection(parsed.orgId);

    const supabase = await createClient({ admin: true });
    const { error: insertError } = await supabase.from('email_connections').insert({
      organization_id: parsed.orgId,
      provider,
      email,
      status: 'connected',
      error_message: null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });

    if (insertError) {
      logger.error('Failed to persist email connection', undefined, { errorMessage: insertError.message });
      return failTo('save_failed');
    }

    return NextResponse.redirect(new URL(`/${locale}/settings/email?email_connected=1`, request.url));
  } catch (err) {
    logger.error('Email OAuth callback failed', err, { provider });
    return failTo('unexpected');
  }
}
