import { getTranslations } from 'next-intl/server';
import { getOrgBanks, getCatalogBanksForOrg } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.banks') };
}
import { BanksSection } from './_components/banks-section';

export default async function BanksSettingsPage() {
  const [banks, catalogBanks] = await Promise.all([
    getOrgBanks(),
    getCatalogBanksForOrg(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <BanksSection initialBanks={banks} catalogBanks={catalogBanks} />
    </div>
  );
}
