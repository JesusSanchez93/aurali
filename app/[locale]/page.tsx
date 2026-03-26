import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export default async function Home() {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    // redirect('/auth/login');
  }

  if (user && profile?.onboarding_status !== 'completed') {
    redirect('/onboarding');
  }

  redirect('/dashboard');
}
