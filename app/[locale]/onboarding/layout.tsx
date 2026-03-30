import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { redirect } from 'next/navigation';
import { OnboardingProgress } from '@/components/app/onboarding/onboarding-progress';
import { Logo } from '@/components/common/logo';
import { ScrollToTop } from '@/components/app/onboarding/scroll-to-top';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    redirect('/auth/login');
  }

  if (profile?.system_role === 'SUPERADMIN') {
    redirect('/admin/clients');
  }

  if (profile?.onboarding_status === 'completed') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-center backdrop-blur-sm bg-background/80 px-6">
        <OnboardingProgress />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full flex-col items-center gap-8">
          <Logo size={30} />
          {children}
        </div>
      </main>
    </div>
  );
}
