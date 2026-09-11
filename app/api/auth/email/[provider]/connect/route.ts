/**
 * GET /api/auth/email/[provider]/connect?locale=es
 *
 * Starts the OAuth authorization-code flow to connect an organization's own
 * Google Workspace or Microsoft 365 mailbox. Only an org admin may initiate
 * this — the organization comes from the authenticated session, never from
 * client input, so the callback can't be tricked into writing to another
 * organization's connection.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth, requireOrgAdmin } from '@/lib/auth/permissions';
import { OAUTH_PROVIDERS, getRedirectUri, isOAuthEmailProvider } from '@/lib/email/oauth/providers';

export const OAUTH_STATE_COOKIE = 'aurali_email_oauth_state';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const locale = request.nextUrl.searchParams.get('locale') ?? 'es';
  const base = `/${locale}/settings/email`;

  if (!isOAuthEmailProvider(provider)) {
    return NextResponse.redirect(new URL(`${base}?email_error=unsupported_provider`, request.url));
  }

  const profile = await requireAuth();
  const orgId = profile.current_organization_id;
  if (!orgId) {
    return NextResponse.redirect(new URL(`${base}?email_error=no_organization`, request.url));
  }
  await requireOrgAdmin(orgId);

  const config = OAUTH_PROVIDERS[provider];
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL(`${base}?email_error=not_configured`, request.url));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, orgId, locale, provider }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', getRedirectUri(provider));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', config.scope);
  authorizeUrl.searchParams.set('state', state);
  for (const [key, value] of Object.entries(config.extraAuthorizeParams ?? {})) {
    authorizeUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(authorizeUrl);
}
