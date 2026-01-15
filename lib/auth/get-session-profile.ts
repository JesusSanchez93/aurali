import { createClient } from '@/lib/supabase/server';

export async function getSessionProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, firstname, lastname, email, phone, onboarding_status, created_at, updated_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile };
}
