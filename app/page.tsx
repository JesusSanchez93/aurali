import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export default async function Home() {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    redirect('/auth/login');
  }

  if (profile?.onboarding_status !== 'COMPLETED') {
    redirect('/onboarding');
  }

  redirect('/dashboard');
}
