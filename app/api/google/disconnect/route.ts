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

  try {
    await revokeGoogleTokens(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al desconectar Google';
    console.error('[DELETE /api/google/disconnect]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
