'use client';

import { Button } from '@/components/ui/button';
import { sendEmail } from './actions';

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-6">
      <Button
        onClick={() => sendEmail({ email: 'jdavidsanchez1993@gmail.com' })}
      >
        Send email
      </Button>
    </div>
  );
}
