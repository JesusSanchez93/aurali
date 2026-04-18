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
