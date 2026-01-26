'use server';

import { createClient } from '@/lib/supabase/server';

export async function updateProfileAction(values: {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
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
      firstname: values.firstname,
      lastname: values.lastname,
      email: values.email,
      phone: values.phone,
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

  // DEBUG: Check if we can see the organization
  const { data: orgCheck, error: checkError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile?.current_organization_id)
    .single();

  console.log('[DEBUG] Organization visibility check:', {
    found: !!orgCheck,
    id: profile?.current_organization_id,
    createdByInDb: orgCheck?.created_by,
    userId: user.id,
    checkError,
  });

  if (!orgCheck) {
    console.error(
      'User cannot see the organization. RLS is likely blocking generic access.',
    );
  }

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: values.name,
      legal_name: values.legal_name,
      nit: values.nit,
      address: values.address,
      country: values.country,
      city: values.city,
      created_by: user.id,
    })
    .eq('id', profile?.current_organization_id)
    .select();
  console.log('updateFirstOrganization: ', { data, error, values, profile });

  if (error) {
    throw new Error(error.message);
  }
}
