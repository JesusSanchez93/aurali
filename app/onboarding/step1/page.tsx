import Step1Form from '@/components/app/onboarding/step1-form';
import { createClient } from '@/lib/supabase/server';

export default async function Step1Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('firstname, lastname, email, phone')
    .eq('id', user.id)
    .single();

  return (
    <Step1Form
      profile={{
        firstname: profile?.firstname ?? '',
        lastname: profile?.lastname ?? '',
        email: profile?.email ?? '',
        phone: profile?.phone ?? '',
      }}
    />
  );
}
