/**
 * lib/google/auth.ts
 *
 * Helpers para el flujo OAuth 2.0 con Google y gestión de tokens por organización.
 * Usa fetch nativo para no añadir dependencias pesadas al bundle de Vercel.
 */

import { createClient } from '@/lib/supabase/server';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Scopes requeridos por la Docs API y Drive API
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function getEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// ─── OAuth URL ─────────────────────────────────────────────────────────────────

/**
 * Genera la URL de autorización de Google OAuth.
 * `state` debe llevar el orgId codificado para recuperarlo en el callback.
 */
export function buildOAuthUrl(state: string): string {
  const { clientId, redirectUri } = getEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',   // siempre pedir refresh_token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── Exchange code ─────────────────────────────────────────────────────────────

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email?: string;
}

/**
 * Intercambia el `code` del callback por tokens de acceso y refresco.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error al obtener tokens de Google: ${err}`);
  }

  const json = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!json.refresh_token) {
    throw new Error(
      'Google no devolvió refresh_token. Revoca el acceso en tu cuenta de Google e intenta de nuevo.',
    );
  }

  // Obtener email del usuario para mostrarlo en la UI
  let email: string | undefined;
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json() as { email?: string };
      email = info.email;
    }
  } catch {
    // email es opcional; no bloquear el flujo
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
    email,
  };
}

// ─── Refresh token ─────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const { clientId, clientSecret } = getEnv();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error al refrescar token de Google: ${err}`);
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  return json;
}

// ─── Get valid access token ─────────────────────────────────────────────────────

/**
 * Retorna un access_token válido para el usuario.
 * Si está expirado (o expira en <60s), lo refresca automáticamente.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient({ admin: true }) as any;

  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[getValidAccessToken] No se encontró token de Google', {
      userId,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
      errorDetails: error?.details ?? null,
    });
    throw new Error(
      'No tienes una cuenta de Google conectada. Ve a Configuración → Google Docs.',
    );
  }

  const expiresAt = new Date(data.expires_at as string).getTime();
  const nowMs = Date.now();
  const bufferMs = 60 * 1000; // 60 segundos de margen

  if (expiresAt - nowMs > bufferMs) {
    return data.access_token as string;
  }

  // Token expirado o por expirar → refrescar
  const refreshed = await refreshAccessToken(data.refresh_token as string);
  const newExpiresAt = new Date(nowMs + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from('google_oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}

// ─── Refresh all (cron) ──────────────────────────────────────────────────────

export interface RefreshAllTokensSummary {
  refreshed: number;
  /** Refresh tokens Google rejected as invalid_grant — deleted so the UI shows "no conectado" instead of failing silently at document-generation time. */
  revoked: { userId: string; email: string | null; organizationId: string | null }[];
  /** Refresh attempts that failed for a reason other than invalid_grant (e.g. network) — token kept as-is, safe to retry next run. */
  failed: { userId: string; email: string | null; error: string }[];
}

/**
 * Proactively refreshes the access_token for every connected Google account,
 * regardless of current expiry. Meant to run on a schedule (see
 * app/api/cron/refresh-google-tokens/route.ts) so:
 *  - refresh tokens stay "active" (mitigates the 6-months-unused revocation),
 *  - a dead refresh_token (invalid_grant — e.g. OAuth consent screen still in
 *    "Testing" mode, where Google expires refresh tokens after 7 days) is
 *    detected and cleaned up proactively, instead of failing mid-request when
 *    a lawyer tries to generate a document.
 */
export async function refreshAllGoogleTokens(): Promise<RefreshAllTokensSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient({ admin: true }) as any;

  const { data: tokens, error } = await supabase
    .from('google_oauth_tokens')
    .select('user_id, refresh_token, google_email, organization_id');

  if (error) throw new Error(`Error al listar tokens de Google: ${error.message}`);

  const summary: RefreshAllTokensSummary = { refreshed: 0, revoked: [], failed: [] };

  for (const row of (tokens ?? []) as {
    user_id: string | null;
    refresh_token: string;
    google_email: string | null;
    organization_id: string | null;
  }[]) {
    if (!row.user_id) continue;

    try {
      const refreshed = await refreshAccessToken(row.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabase
        .from('google_oauth_tokens')
        .update({
          access_token: refreshed.access_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', row.user_id);

      summary.refreshed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('invalid_grant')) {
        await supabase.from('google_oauth_tokens').delete().eq('user_id', row.user_id);
        summary.revoked.push({ userId: row.user_id, email: row.google_email, organizationId: row.organization_id });
        console.error('[refreshAllGoogleTokens] Refresh token inválido/revocado — cuenta desconectada', {
          userId: row.user_id,
          email: row.google_email,
          organizationId: row.organization_id,
        });
      } else {
        summary.failed.push({ userId: row.user_id, email: row.google_email, error: message });
        console.error('[refreshAllGoogleTokens] Error al refrescar token', { userId: row.user_id, error: message });
      }
    }
  }

  return summary;
}

// ─── Revoke ────────────────────────────────────────────────────────────────────

/**
 * Revoca el refresh_token en Google y elimina el registro de la DB.
 */
export async function revokeGoogleTokens(userId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient({ admin: true }) as any;

  const { data } = await supabase
    .from('google_oauth_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();

  if (data?.refresh_token) {
    // Revocar en Google (best-effort, no bloquear si falla)
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(data.refresh_token as string)}`, {
        method: 'POST',
      });
    } catch {
      // ignorar errores de red al revocar
    }
  }

  await supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('user_id', userId);
}
