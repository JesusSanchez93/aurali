import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAllowedStep } from '@/lib/onboarding/get-next-step';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    redirect('/auth/login');
  }

  if (profile?.onboarding_status === 'completed') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6">
      {children}
    </div>
  );
}
