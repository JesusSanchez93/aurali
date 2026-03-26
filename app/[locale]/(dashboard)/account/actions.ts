'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAccountProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: profile }, { data: memberships }, { data: catalogDocuments }] = await Promise.all([
    db
      .from('profiles')
      .select('id, firstname, lastname, email, phone, document_type, document_number')
      .eq('id', user.id)
      .single(),
    db
      .from('organization_members')
      .select('role, active, organizations(id, name)')
      .eq('user_id', user.id),
    db
      .from('catalog_documents')
      .select('slug, name')
      .eq('is_active', true)
      .order('slug'),
  ]);

  return { profile, memberships: memberships ?? [], catalogDocuments: catalogDocuments ?? [] };
}

export async function updateAccountProfile(values: {
  firstname: string;
  lastname: string;
  phone: string;
  document_type: string;
  document_number: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('profiles')
    .update({
      firstname: values.firstname,
      lastname: values.lastname,
      phone: values.phone,
      document_type: values.document_type,
      document_number: values.document_number,
    })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
}
