'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── READ ──────────────────────────────────────────────────────────────────────

export async function getCatalogBanks() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('catalog_banks')
    .select('id, name, code, slug, is_active, document_slug, document_name, document_number, legal_rep_first_name, legal_rep_last_name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any as Array<{
    id: string; name: string; code: string; slug: string; is_active: boolean;
    document_slug: string | null;
    document_name: { es?: string; en?: string } | null;
    document_number: string | null;
    legal_rep_first_name: string | null;
    legal_rep_last_name: string | null;
  }>;
}

export async function getCatalogDocuments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_documents')
    .select('id, slug, name, is_active')
    .order('slug', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    ...d,
    name: d.name as { es?: string; en?: string },
  }));
}

// ─── BANKS ─────────────────────────────────────────────────────────────────────

export async function addCatalogBank(
  name: string,
  code: string,
  documentSlug?: string | null,
  documentName?: { es?: string; en?: string } | null,
  documentNumber?: string,
  legalRepFirstName?: string,
  legalRepLastName?: string,
) {
  const supabase = await createClient();
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const normalizedCode = code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('catalog_banks')
    .insert({
      name,
      code: normalizedCode,
      slug,
      document_slug: documentSlug ?? null,
      document_name: documentName ?? null,
      document_number: documentNumber || null,
      legal_rep_first_name: legalRepFirstName || null,
      legal_rep_last_name:  legalRepLastName || null,
    });

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function updateCatalogBank(
  id: string,
  name: string,
  code: string,
  documentSlug?: string | null,
  documentName?: { es?: string; en?: string } | null,
  documentNumber?: string,
  legalRepFirstName?: string,
  legalRepLastName?: string,
) {
  const supabase = await createClient();
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const normalizedCode = code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('catalog_banks')
    .update({
      name,
      code: normalizedCode,
      slug,
      document_slug: documentSlug ?? null,
      document_name: documentName ?? null,
      document_number: documentNumber || null,
      legal_rep_first_name: legalRepFirstName || null,
      legal_rep_last_name:  legalRepLastName || null,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function toggleCatalogBank(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('catalog_banks')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function deleteCatalogBank(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('catalog_banks').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

// ─── DOCUMENTS ─────────────────────────────────────────────────────────────────

export async function addCatalogDocument(nameEs: string, nameEn: string, slug: string) {
  const supabase = await createClient();
  const normalizedSlug = slug.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

  const { error } = await supabase
    .from('catalog_documents')
    .insert({ slug: normalizedSlug, name: { es: nameEs, en: nameEn || nameEs } });

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function updateCatalogDocument(id: string, nameEs: string, nameEn: string, slug: string) {
  const supabase = await createClient();
  const normalizedSlug = slug.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

  const { error } = await supabase
    .from('catalog_documents')
    .update({ slug: normalizedSlug, name: { es: nameEs, en: nameEn || nameEs } })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function toggleCatalogDocument(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('catalog_documents')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}

export async function deleteCatalogDocument(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('catalog_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/catalog');
}
