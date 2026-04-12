import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { Link, redirect } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, Building2, Landmark, FileText, GitBranch } from 'lucide-react';

const STEP_LIST = [
  {
    icon: User,
    label: 'Perfil personal',
    desc: 'Tu nombre, documento e información de contacto.',
  },
  {
    icon: Building2,
    label: 'Organización',
    desc: 'Datos legales y ubicación de tu firma.',
  },
  {
    icon: Landmark,
    label: 'Bancos',
    desc: 'Entidades bancarias con las que trabajas.',
  },
  {
    icon: FileText,
    label: 'Tipos de documento',
    desc: 'Documentos de identidad que acepta tu organización.',
  },
  {
    icon: GitBranch,
    label: 'Flujo de trabajo',
    desc: 'El proceso que guiará cada caso legal.',
  },
];

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
      redirect({ href: '/analytics', locale });
  }

  return (
    <div className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Configuración inicial
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <div className="mb-8 space-y-1">
        {STEP_LIST.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5"
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{step.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center gap-4 bg-background/80 py-4 backdrop-blur-sm">
        <Button asChild>
          <Link href="/onboarding/step1">
            {t('start')}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">~3 minutos</span>
      </div>
    </div>
  );
}
