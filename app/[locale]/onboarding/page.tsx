import { Button } from '@/components/ui/button';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { Link, redirect } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

export default async function OnboardingPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const { profile } = await getSessionProfile();
  const t = await getTranslations('onboarding.home');

  switch (profile?.onboarding_status) {
    case 'step1_completed':
      redirect({ href: '/onboarding/step2', locale });
    case 'step2_completed':
      redirect({ href: '/onboarding/step3', locale });
    case 'step3_completed':
      redirect({ href: '/onboarding/step4', locale });
    case 'step4_completed':
      redirect({ href: '/onboarding/workflow-selection', locale });
    case 'completed':
      redirect({ href: '/dashboard', locale });
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4 text-center">
      <h1 className="text-5xl">{t('title')}</h1>
      <p>
        {t('description')}
      </p>
      <Button asChild>
        <Link href="/onboarding/step1">{t('start')}</Link>
      </Button>
    </div>
  );
}
