/**
 * GET /api/google/auth
 *
 * Inicia el flujo OAuth 2.0 con Google.
 * Requiere sesión autenticada.
 * Redirige al usuario a la pantalla de autorización de Google.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildOAuthUrl } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // El locale para el redirect de regreso se extrae de la cabecera Referer o se usa 'es' por defecto
  const referer = request.headers.get('referer') ?? '';
  const localeMatch = referer.match(/\/([a-z]{2})\//);
  const locale = localeMatch?.[1] ?? 'es';

  // Codificar userId + locale en el state (base64, sin criptografía compleja)
  const state = Buffer.from(
    JSON.stringify({ userId: user.id, locale }),
  ).toString('base64url');

  try {
    const oauthUrl = buildOAuthUrl(state);
    return NextResponse.redirect(oauthUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al iniciar OAuth con Google';
    console.error('[GET /api/google/auth]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
