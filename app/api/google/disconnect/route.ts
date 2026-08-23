/**
 * DELETE /api/google/disconnect
 *
 * Revoca el token de Google y elimina el registro de la DB.
 * Requiere sesión autenticada con rol ORG_ADMIN.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeGoogleTokens } from '@/lib/google/auth';

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, current_organization_id')
    .eq('id', user.id)
    .single();

  if (profile?.system_role !== 'SUPERADMIN') {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', profile?.current_organization_id ?? '')
      .eq('user_id', user.id)
      .eq('role', 'ORG_ADMIN')
      .eq('active', true)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'Solo un administrador de la organización puede desconectar Google.' },
        { status: 403 },
      );
    }
  }

  try {
    await revokeGoogleTokens(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al desconectar Google';
    console.error('[DELETE /api/google/disconnect]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
