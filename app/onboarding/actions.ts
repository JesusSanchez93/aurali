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

export async function createOrganization(values: {
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

  const { error } = await supabase.from('organizations').insert({
    name: values.name,
    legal_name: values.legal_name,
    nit: values.nit,
    address: values.address,
    country: values.country,
    city: values.city,
    created_by: user.id,
  });
  console.log('createOrganization: ', { error });

  if (error) {
    throw new Error(error.message);
  }
}
