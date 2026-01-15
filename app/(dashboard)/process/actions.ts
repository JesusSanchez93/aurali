'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export async function createClientDraft(values: { email: string }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('email', values.email)
    .single();

  let clientId = client?.id;

  if (!client) {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        status: 'draft',
        email: values.email,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    clientId = newClient.id;
    revalidatePath('/process');
  }
}
