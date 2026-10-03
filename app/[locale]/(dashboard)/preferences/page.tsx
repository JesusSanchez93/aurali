import { getTranslations } from 'next-intl/server';
import PreferencesSection from '@/components/app/settings/preferences-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('preferences.title') };
}

export default function PreferencesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <PreferencesSection />
    </div>
  );
}
