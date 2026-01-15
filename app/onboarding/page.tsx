import { Button } from '@/components/ui/button';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const { profile } = await getSessionProfile();

  switch (profile?.onboarding_status) {
    case 'step1_completed':
      redirect('/onboarding/step2');
  }

  return (
    <div className="w-full max-w-screen-sm space-y-4 text-center">
      <h1 className="text-5xl">Aurali.app</h1>
      <p>
        La empleada digital para bufete y abogados que te ayuda a automatizar
        los procesos internos y a ser mas efectivos en el uso del tiempo, para
        que tu enfoque sea en lo verdaderamente importante.
      </p>
      <Button asChild>
        <Link href="/onboarding/step1">Iniciar</Link>
      </Button>
    </div>
  );
}
