import { getTranslations } from 'next-intl/server';
import { getDashboardStats, getDashboardAnalytics } from '../actions';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.analytics') };
}
import DashboardCards from '@/components/app/dashboard/dashboard-cards';
import AnalyticsSection from '@/components/app/dashboard/analytics-section';
import FinancialsSection from '@/components/app/dashboard/financials-section';
import { Separator } from '@/components/ui/separator';

export default async function AnalyticsPage() {
  const [stats, analytics] = await Promise.all([
    getDashboardStats(),
    getDashboardAnalytics(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <DashboardCards {...stats} />
      <FinancialsSection data={analytics.financials} />
      <Separator />
      <AnalyticsSection data={analytics} />
    </div>
  );
}
