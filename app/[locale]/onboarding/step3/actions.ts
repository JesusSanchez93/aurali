'use server';

import { createClient } from '@/lib/supabase/server';

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');
  return { supabase, user, orgId: profile.current_organization_id };
}

export async function getCatalogBanks() {
  const { supabase } = await getContext();
  const { data, error } = await supabase
    .from('catalog_banks')
    .select('id, name, code, slug')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveOrgBanks(selectedIds: string[]) {
  const { supabase, user, orgId } = await getContext();

  if (selectedIds.length === 0) throw new Error('Debes seleccionar al menos un banco');

  // Fetch selected catalog banks
  const { data: catalogBanks, error: fetchError } = await supabase
    .from('catalog_banks')
    .select('name, code, slug')
    .in('id', selectedIds);

  if (fetchError || !catalogBanks) throw new Error('Error al obtener los bancos seleccionados');

  // Replace org banks entirely
  await supabase.from('banks').delete().eq('organization_id', orgId);

  const { error: insertError } = await supabase.from('banks').insert(
    catalogBanks.map((b) => ({
      name: b.name,
      code: b.code,
      slug: b.slug,
      organization_id: orgId,
      created_by: user.id,
    }))
  );

  if (insertError) throw new Error(insertError.message);

  // Advance onboarding status
  await supabase.from('profiles').update({ onboarding_status: 'step3_completed' }).eq('id', user.id);
}
