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

export async function getCatalogDocuments() {
  const { supabase } = await getContext();
  const { data, error } = await supabase
    .from('catalog_documents')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('slug', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    id: d.id,
    slug: d.slug as string,
    name: d.name as { es?: string; en?: string },
  }));
}

export async function saveOrgDocuments(selectedIds: string[]) {
  const { supabase, user, orgId } = await getContext();

  if (selectedIds.length === 0) throw new Error('Debes seleccionar al menos un tipo de documento');

  // Fetch selected catalog documents
  const { data: catalogDocs, error: fetchError } = await supabase
    .from('catalog_documents')
    .select('slug, name')
    .in('id', selectedIds);

  if (fetchError || !catalogDocs) throw new Error('Error al obtener los documentos seleccionados');

  // Replace org documents entirely
  await supabase.from('documents').delete().eq('organization_id', orgId);

  const { error: insertError } = await supabase.from('documents').insert(
    catalogDocs.map((d) => ({
      slug: d.slug,
      name: d.name,
      organization_id: orgId,
      created_by: user.id,
    }))
  );

  if (insertError) throw new Error(insertError.message);

  // Advance onboarding status
  await supabase.from('profiles').update({ onboarding_status: 'step4_completed' }).eq('id', user.id);
}
