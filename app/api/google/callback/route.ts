/**
 * GET /api/google/callback
 *
 * Callback OAuth 2.0 de Google.
 * Intercambia el `code` por tokens y los guarda en la DB.
 * Redirige al usuario de vuelta a settings con parámetro ?google=connected.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // El usuario canceló o hubo error en Google
  if (errorParam) {
    return NextResponse.redirect(
      new URL('/es/settings/google-templates?google=cancelled', request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/es/settings/google-templates?google=error', request.url),
    );
  }

  // Decodificar state → userId + locale
  let userId: string;
  let locale = 'es';
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string;
      locale: string;
    };
    userId = parsed.userId;
    locale = parsed.locale ?? 'es';
  } catch {
    return NextResponse.redirect(
      new URL('/es/settings/google-templates?google=error', request.url),
    );
  }

  const redirectBase = new URL(request.url).origin;
  const successUrl = `${redirectBase}/${locale}/settings/google-templates?google=connected`;
  const errorUrl = `${redirectBase}/${locale}/settings/google-templates?google=error`;

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Guardar con service role para saltar RLS en el upsert inicial
    const supabase = await createClient({ admin: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error } = await db.from('google_oauth_tokens').upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        google_email: tokens.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[google/callback] Error guardando tokens:', error.message);
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.redirect(successUrl);
  } catch (err) {
    console.error('[google/callback]', err instanceof Error ? err.message : err);
    return NextResponse.redirect(errorUrl);
  }
}
