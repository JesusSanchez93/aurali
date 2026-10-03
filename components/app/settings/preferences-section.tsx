'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ES, GB } from 'country-flag-icons/react/3x2';

import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

function Flag({ children }: { children: ReactNode }) {
  return (
    <div className="size-5 overflow-hidden rounded-full border border-muted shadow-sm">
      <div className="flex size-full scale-[1.5] items-center justify-center">{children}</div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/5 font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function PreferencesSection() {
  const t = useTranslations('common.preferences');
  const tTheme = useTranslations('common.theme');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { theme, setTheme } = useTheme();
  // next-themes solo conoce el tema en el cliente: evita un desajuste de hidratación.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const changeLocale = (nextLocale: string) => {
    if (nextLocale === locale) return;
    router.replace(
      // @ts-expect-error -- TypeScript doesn't know that the params match the pathname
      { pathname, params },
      { locale: nextLocale },
    );
  };

  const themes = [
    { value: 'light', label: tTheme('light'), icon: Sun },
    { value: 'dark', label: tTheme('dark'), icon: Moon },
    { value: 'system', label: tTheme('system'), icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Section title={t('language')} description={t('language_description')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionButton active={locale === 'es'} onClick={() => changeLocale('es')}>
            <Flag><ES /></Flag>
            Español
          </OptionButton>
          <OptionButton active={locale === 'en'} onClick={() => changeLocale('en')}>
            <Flag><GB /></Flag>
            English
          </OptionButton>
        </div>
      </Section>

      <Section title={t('theme')} description={t('theme_description')}>
        <div className="grid gap-2 sm:grid-cols-3">
          {themes.map(({ value, label, icon: Icon }) => (
            <OptionButton key={value} active={mounted && theme === value} onClick={() => setTheme(value)}>
              <Icon className="size-4" />
              {label}
            </OptionButton>
          ))}
        </div>
      </Section>
    </div>
  );
}
