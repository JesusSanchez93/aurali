'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireOrgAdmin } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function getOrgContext() {
  const supabase = await createClient();
  const profile = await requireAuth();
  const orgId = profile.current_organization_id;
  if (!orgId) throw new Error('No organization');
  await requireOrgAdmin(orgId);
  return { supabase: supabase as DB, orgId, userId: profile.id };
}

export type OrgDocument = {
  id: string;
  slug: string;
  is_active: boolean;
  name: { es?: string; en?: string } | null;
};

export type CatalogDocumentOption = {
  id: string;
  slug: string;
  name: { es?: string; en?: string };
};

export async function getOrgDocuments(): Promise<OrgDocument[]> {
  const { supabase, orgId } = await getOrgContext();
  const { data, error } = await supabase
    .from('documents')
    .select('id, slug, name, is_active')
    .eq('organization_id', orgId)
    .order('slug', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((d: { id: string; slug: string; is_active: boolean; name: unknown }) => ({
    ...d,
    name: d.name as { es?: string; en?: string } | null,
  }));
}

export async function getCatalogDocumentsForOrg(): Promise<CatalogDocumentOption[]> {
  const { supabase } = await getOrgContext();
  const { data, error } = await supabase
    .from('catalog_documents')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('slug', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((d: { id: string; slug: string; name: unknown }) => ({
    ...d,
    name: d.name as { es?: string; en?: string },
  }));
}

export async function addOrgDocument(catalogDocumentId: string): Promise<void> {
  const { supabase, orgId, userId } = await getOrgContext();

  const { data: catalog, error: fetchErr } = await supabase
    .from('catalog_documents')
    .select('slug, name')
    .eq('id', catalogDocumentId)
    .single();

  if (fetchErr || !catalog) throw new Error('Tipo de documento no encontrado en el catálogo');

  const { error } = await supabase.from('documents').insert({
    slug: catalog.slug,
    name: catalog.name,
    organization_id: orgId,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/settings/documents');
}

export async function toggleOrgDocument(documentId: string, isActive: boolean): Promise<void> {
  const { supabase, orgId } = await getOrgContext();

  const { error } = await supabase
    .from('documents')
    .update({ is_active: isActive })
    .eq('id', documentId)
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/documents');
}

export async function removeOrgDocument(documentId: string): Promise<void> {
  const { supabase, orgId } = await getOrgContext();

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/documents');
}
