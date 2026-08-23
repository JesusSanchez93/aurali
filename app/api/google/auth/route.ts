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

  // El locale para el redirect de regreso se extrae de la cabecera Referer o se usa 'es' por defecto
  const referer = request.headers.get('referer') ?? '';
  const localeMatch = referer.match(/\/([a-z]{2})\//);
  const locale = localeMatch?.[1] ?? 'es';
  const settingsUrl = (query: string) => new URL(`/${locale}/settings/google-templates?google=${query}`, request.url);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, current_organization_id')
    .eq('id', user.id)
    .single();

  const orgId = profile?.current_organization_id ?? '';

  if (profile?.system_role !== 'SUPERADMIN') {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('role', 'ORG_ADMIN')
      .eq('active', true)
      .maybeSingle();

    if (!membership) {
      return NextResponse.redirect(settingsUrl('forbidden'));
    }
  }

  // Solo una cuenta de Google conectada por organización — si otro miembro
  // activo ya tiene una, no se permite conectar una segunda.
  const { data: otherMembers } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .neq('user_id', user.id);

  const otherMemberIds = (otherMembers ?? []).map((m: { user_id: string }) => m.user_id);
  if (otherMemberIds.length > 0) {
    const adminSupabase = await createClient({ admin: true });
    const { data: existingToken } = await adminSupabase
      .from('google_oauth_tokens')
      .select('user_id')
      .in('user_id', otherMemberIds)
      .limit(1)
      .maybeSingle();

    if (existingToken) {
      return NextResponse.redirect(settingsUrl('already_connected'));
    }
  }

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
