'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function logoutAction() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, current_organization_id')
      .eq('id', user.id)
      .single();

    // SUPERADMIN: clear any impersonated org before signing out
    if (profile?.system_role === 'SUPERADMIN' && profile.current_organization_id) {
      await supabase
        .from('profiles')
        .update({ current_organization_id: null })
        .eq('id', user.id);
    }
  }

  await supabase.auth.signOut();
  redirect('/auth/login');
}
