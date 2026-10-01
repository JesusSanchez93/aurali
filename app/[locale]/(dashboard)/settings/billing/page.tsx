import { getTranslations } from 'next-intl/server';
import { getBillingOverview, getBillingTransferInfo, getOrgPaymentHistory } from './actions'
import { BillingSection } from './_components/billing-section'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.billing') };
}

export default async function BillingSettingsPage() {
  const [overview, transferInfo, payments] = await Promise.all([
    getBillingOverview(),
    getBillingTransferInfo(),
    getOrgPaymentHistory(),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <BillingSection overview={overview} transferInfo={transferInfo} payments={payments} />
    </div>
  )
}
