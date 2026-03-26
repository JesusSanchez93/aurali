import { getDashboardStats } from '../actions';
import DashboardCards from '@/components/app/dashboard/dashboard-cards';

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6 p-6">
      <DashboardCards {...stats} />
    </div>
  );
}
