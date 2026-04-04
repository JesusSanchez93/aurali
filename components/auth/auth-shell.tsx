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
            <Link href="/" className="inline-flex items-center gap-3 text-[#1E1B4B]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1E1B4B] text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(30,27,75,0.75)]">
                A
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight">Aurali</p>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#6B7280]">
                  {t('brandLine')}
                </p>
              </div>
            </Link>

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
          <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <section className="order-2 lg:order-1">
              <div className="max-w-lg space-y-5 lg:max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.16)] bg-white/78 px-3.5 py-2 text-xs font-semibold text-[#1E1B4B] backdrop-blur">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  {t('eyebrow')}
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-[14ch] text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl lg:text-[2.65rem]">
                    {title}
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-[#6B7280] sm:text-base">
                    {description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/60 bg-white/75 p-3.5 shadow-[0_20px_50px_-32px_rgba(30,27,75,0.35)] backdrop-blur">
                    <p className="text-xl font-bold tracking-tight text-[#1E1B4B]">80%</p>
                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">{t('stats.time')}</p>
                  </div>
                  <div className="rounded-3xl border border-white/60 bg-white/75 p-3.5 shadow-[0_20px_50px_-32px_rgba(30,27,75,0.35)] backdrop-blur">
                    <p className="text-xl font-bold tracking-tight text-[#1E1B4B]">3x</p>
                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">{t('stats.capacity')}</p>
                  </div>
                  <div className="rounded-3xl border border-white/60 bg-white/75 p-3.5 shadow-[0_20px_50px_-32px_rgba(30,27,75,0.35)] backdrop-blur">
                    <p className="text-xl font-bold tracking-tight text-[#1E1B4B]">IA</p>
                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">{t('stats.documents')}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/60 bg-white/70 p-4 shadow-[0_28px_60px_-34px_rgba(30,27,75,0.34)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-600">
                        {t('panelLabel')}
                      </p>
                      <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[#1E1B4B]">
                        {t('panelTitle')}
                      </h2>
                    </div>
                    <div className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700">
                      {t('panelBadge')}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {workflowCards.map((card, index) => {
                      const Icon = card.icon;

                      return (
                        <div
                          key={index}
                          className="rounded-3xl border border-slate-100 bg-white/90 p-3.5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.38)]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[#1E1B4B]">
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1 space-y-2.5">
                              <p className="text-xs font-semibold text-slate-900 sm:text-sm">
                                {t(`steps.${index + 1}`)}
                              </p>
                              <div className="h-2.5 rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#1E1B4B] via-[#7C3AED] to-[#F59E0B]"
                                  style={{ width: card.width }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="order-1 lg:order-2">
              <div className="mx-auto w-full max-w-md lg:ml-auto">
                {children}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
