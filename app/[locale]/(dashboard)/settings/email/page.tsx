import { getTranslations } from 'next-intl/server';
import { getEmailConnection } from './actions';
import { EmailSection } from './_components/email-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.email_settings') };
}

export default async function EmailSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const connection = await getEmailConnection();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <EmailSection initialConnection={connection} locale={locale} />
    </div>
  );
}
