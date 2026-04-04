import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Bot, FileText, ShieldCheck, Workflow } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { ThemeSwitcher } from '@/components/app/theme-switcher';

interface AuthShellProps {
  children: ReactNode;
  variant: 'login' | 'signup';
}

const workflowCards = [
  { icon: Workflow, width: '74%' },
  { icon: Bot, width: '61%' },
  { icon: FileText, width: '83%' },
];

export async function AuthShell({ children, variant }: AuthShellProps) {
  const t = await getTranslations('auth.shell');
  const title = variant === 'login' ? t('loginTitle') : t('signUpTitle');
  const description = variant === 'login' ? t('loginDescription') : t('signUpDescription');

  return (
    <div className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#fafafa_54%,_#f5f3ff_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(30,27,75,0.08)_1px,_transparent_0)] [background-size:22px_22px]" />
      <div className="absolute left-[8%] top-[12%] h-36 w-36 rounded-full bg-[rgba(124,58,237,0.12)] blur-3xl" />
      <div className="absolute bottom-[10%] right-[8%] h-40 w-40 rounded-full bg-[rgba(245,158,11,0.12)] blur-3xl" />

      <div className="relative z-10 flex min-h-svh flex-col">
        <header className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
            <div />

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-[#1E1B4B] shadow-sm backdrop-blur transition-colors hover:bg-white"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('backHome')}
              </Link>
              <ThemeSwitcher />
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center px-4 pb-8 pt-2 sm:px-6 lg:px-8 lg:pb-12">
          <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
            <section className="order-1 lg:col-start-1 lg:row-start-1">
              <div className="max-w-lg space-y-5 lg:max-w-md">
                <div>
                  <Link href="/" className="mb-2 inline-flex items-center gap-3 text-[#1E1B4B]">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E1B4B] text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(30,27,75,0.75)]">
                      A
                    </span>
                    <p className="text-xl font-bold tracking-tight">Aurali</p>
                  </Link>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#6B7280]">
                    {t('brandLine')}
                  </p>
                </div>

              </div>
            </section>

            <section className="order-2 lg:col-start-2 lg:row-span-3 lg:row-start-1">
              <div className="mx-auto w-full max-w-md lg:ml-auto">
                {children}
              </div>
            </section>

            <section className="order-3 lg:col-start-1 lg:row-start-2">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.16)] bg-white/78 px-3.5 py-2 text-xs font-semibold text-[#1E1B4B] backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-violet-600" />
                {t('eyebrow')}
              </div>
              <div className="max-w-lg space-y-3 lg:max-w-md">
                <h1 className="max-w-[14ch] text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl lg:text-[2.65rem]">
                  {title}
                </h1>
                <p className="max-w-xl text-sm leading-7 text-[#6B7280] sm:text-base">
                  {description}
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
