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

export type OrgBank = {
  id: string;
  name: string;
  code: string;
  slug: string;
  is_active: boolean;
  legal_rep_first_name: string | null;
  legal_rep_last_name:  string | null;
};

export type CatalogBankOption = {
  id: string;
  name: string;
  code: string;
  slug: string;
  legal_rep_first_name: string | null;
  legal_rep_last_name:  string | null;
};

export async function getOrgBanks(): Promise<OrgBank[]> {
  const { supabase, orgId } = await getOrgContext();
  const { data, error } = await supabase
    .from('banks')
    .select('id, name, code, slug, is_active, legal_rep_first_name, legal_rep_last_name')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCatalogBanksForOrg(): Promise<CatalogBankOption[]> {
  const { supabase } = await getOrgContext();
  const { data, error } = await supabase
    .from('catalog_banks')
    .select('id, name, code, slug, legal_rep_first_name, legal_rep_last_name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addOrgBank(catalogBankId: string): Promise<void> {
  const { supabase, orgId, userId } = await getOrgContext();

  const { data: catalog, error: fetchErr } = await supabase
    .from('catalog_banks')
    .select('name, code, slug, legal_rep_first_name, legal_rep_last_name')
    .eq('id', catalogBankId)
    .single();

  if (fetchErr || !catalog) throw new Error('Banco no encontrado en el catálogo');

  const { error } = await supabase.from('banks').insert({
    name: catalog.name,
    code: catalog.code,
    slug: catalog.slug,
    legal_rep_first_name: catalog.legal_rep_first_name ?? null,
    legal_rep_last_name:  catalog.legal_rep_last_name ?? null,
    organization_id: orgId,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/settings/banks');
}

export async function removeOrgBank(bankId: string): Promise<void> {
  const { supabase, orgId } = await getOrgContext();

  const { error } = await supabase
    .from('banks')
    .delete()
    .eq('id', bankId)
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/banks');
}

export async function toggleOrgBank(bankId: string, isActive: boolean): Promise<void> {
  const { supabase, orgId } = await getOrgContext();

  const { error } = await supabase
    .from('banks')
    .update({ is_active: isActive })
    .eq('id', bankId)
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/banks');
}

export async function updateOrgBankLegalRep(
  bankId: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const { supabase, orgId } = await getOrgContext();

  const { error } = await supabase
    .from('banks')
    .update({
      legal_rep_first_name: firstName || null,
      legal_rep_last_name:  lastName || null,
    })
    .eq('id', bankId)
    .eq('organization_id', orgId);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/banks');
}
