import { getDashboardStats, getDashboardAnalytics } from '../actions';
import DashboardCards from '@/components/app/dashboard/dashboard-cards';
import AnalyticsSection from '@/components/app/dashboard/analytics-section';

export default async function DashboardPage() {
  const [stats, analytics] = await Promise.all([
    getDashboardStats(),
    getDashboardAnalytics(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <DashboardCards {...stats} />
      <AnalyticsSection data={analytics} />
    </div>
  );
}
