import { getTranslations } from 'next-intl/server';
import { getOrgBanks, getCatalogBanksForOrg } from './actions';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.banks') };
}
import { BanksSection } from './_components/banks-section';

export default async function BanksSettingsPage() {
  const { profile } = await getSessionProfile();
  if (!profile?.catalogs.includes('banks')) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold">Bancos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ninguno de tus tipos de proceso activos usa bancos. Este listado aparecerá cuando actives uno que lo
          necesite en Configuración → Flujos de trabajo.
        </p>
      </div>
    );
  }

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
