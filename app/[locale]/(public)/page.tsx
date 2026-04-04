import { Inter } from 'next/font/google';
import { LandingPage } from '@/components/landing/landing-page';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default async function PublicHomePage() {
  const { user, profile } = await getSessionProfile();
  const platformHref =
    user && profile?.onboarding_status !== 'completed' ? '/onboarding' : '/dashboard';

  return (
    <div className={inter.className}>
      <LandingPage isLoggedIn={Boolean(user)} platformHref={platformHref} />
    </div>
  );
}
