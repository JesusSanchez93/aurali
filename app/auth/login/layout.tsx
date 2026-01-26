import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();

  if (user && profile?.onboarding_status === 'completed') {
    redirect('/dashboard');
  }

  if (user && profile?.onboarding_status !== 'completed') {
    redirect('/onboarding');
  }

  return children;
}
