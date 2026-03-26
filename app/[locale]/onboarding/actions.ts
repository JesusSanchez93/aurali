'use server';

import { createClient } from '@/lib/supabase/server';

export async function updateProfileAction(values: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_type?: string;
  document_number?: string;
  onboarding_status: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      firstname: values.first_name,
      lastname: values.last_name,
      email: values.email,
      phone: values.phone,
      document_type: values.document_type,
      document_number: values.document_number,
      onboarding_status: values.onboarding_status,
    })
    .eq('id', user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateFirstOrganization(values: {
  name: string;
  legal_name: string;
  nit: string;
  address: string;
  city: string;
  region: string;
  country: string;
  onboarding_status: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  await supabase
    .from('profiles')
    .update({
      onboarding_status: values.onboarding_status,
    })
    .eq('id', user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) {
    throw new Error('Organization not found');
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: values.name,
      legal_name: values.legal_name,
      nit: values.nit,
      address: values.address,
      country: values.country,
      region: values.region,
      city: values.city,
      created_by: user.id,
    })
    .eq('id', profile?.current_organization_id)
    .select();

  if (error) {
    throw new Error(error.message);
  }
}
