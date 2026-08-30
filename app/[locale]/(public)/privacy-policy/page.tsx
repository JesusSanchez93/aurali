import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/common/logo';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacyPolicy' });
  return { title: t('title') };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacyPolicy' });
  const sections = t.raw('sections') as { heading: string; body: string }[];

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo size={40} />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('lastUpdated')}</p>

        <p className="mt-6 leading-relaxed text-foreground/90">{t('intro')}</p>

        <div className="mt-8 space-y-8">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-foreground/90">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
