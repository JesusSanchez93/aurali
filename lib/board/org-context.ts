import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Cliente con la sesión, organización actual y usuario — base de las acciones de tableros. */
export async function requireOrgContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');

  return { supabase, organizationId: profile.current_organization_id, userId: user.id };
}

export type OrgContext = Awaited<ReturnType<typeof requireOrgContext>>;

/** Lista de tableros y cada tablero (/board y /board/[id]). */
export function revalidateBoards() {
  revalidatePath('/[locale]/(dashboard)/board', 'layout');
}
