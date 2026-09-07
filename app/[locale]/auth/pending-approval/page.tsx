import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { logoutAction } from '../actions';
import { PendingApprovalContent } from '@/components/auth/pending-approval-content';

export default async function PendingApprovalPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/auth/login');
  if (profile?.system_role === 'SUPERADMIN' || profile?.org_status === 'active') {
    redirect('/analytics');
  }

  const t = await getTranslations('auth.pendingApproval');
  const isRejected = profile?.org_status === 'rejected';

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#fafafa_54%,_#f5f3ff_100%)] p-6 dark:bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_32%),linear-gradient(180deg,_#0a0a0f_0%,_#0d0d12_54%,_#12101c_100%)] md:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(30,27,75,0.08)_1px,_transparent_0)] [background-size:22px_22px] dark:bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.06)_1px,_transparent_0)]" />
      <div
        className={
          isRejected
            ? 'absolute left-[10%] top-[14%] h-44 w-44 rounded-full bg-[rgba(225,29,72,0.14)] blur-3xl dark:bg-[rgba(225,29,72,0.2)]'
            : 'absolute left-[10%] top-[14%] h-44 w-44 rounded-full bg-[rgba(124,58,237,0.16)] blur-3xl dark:bg-[rgba(124,58,237,0.24)]'
        }
      />
      <div className="absolute bottom-[12%] right-[10%] h-40 w-40 rounded-full bg-[rgba(245,158,11,0.12)] blur-3xl dark:bg-[rgba(245,158,11,0.16)]" />

      <PendingApprovalContent
        isRejected={isRejected}
        title={t('title')}
        description={isRejected ? t('rejectedDescription') : t('pendingDescription')}
        notifyByEmail={t('notifyByEmail')}
        logout={t('logout')}
        logoutAction={logoutAction}
      />
    </div>
  );
}
