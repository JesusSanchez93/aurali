import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppNavBar } from '@/components/dashboard/app-navbar';
import { SuperAdminBanner } from '@/components/dashboard/superadmin-banner';
import { SupportAccessBanner } from '@/components/dashboard/support-access-banner';
import { SupportAccessRealtime } from '@/components/dashboard/support-access-realtime';
import { SupportSessionTracker } from '@/components/dashboard/support-session-tracker';
import { EmailConnectionBanner } from '@/components/dashboard/email-connection-banner';
import { PlanUsageBanner } from '@/components/dashboard/plan-usage-banner';
import { CSSProperties, ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { userAgent } from 'next/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import ProfileProvider from '@/components/providers/profile-provider';
import { WorkflowGuideModal } from '@/components/app/dashboard/workflow-guide-modal';
import { SidebarSwipeHandler } from '@/components/dashboard/sidebar-swipe-handler';
import { DashboardLoadingState } from '@/components/dashboard/dashboard-loading-state';
import { MobileHintProvider } from '@/hooks/use-mobile';

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props) {
  const [{ profile }, requestHeaders] = await Promise.all([
    getSessionProfile(),
    headers(),
  ]);
  // Pista server-side para useIsMobile — evita el parpadeo del sidebar al
  // entrar en el dashboard desde un celular (ver hooks/use-mobile.tsx).
  const isMobileUA = userAgent({ headers: requestHeaders }).device.type === 'mobile';

  if (!profile?.id) return <DashboardLoadingState />;

  if (
    profile.system_role !== 'SUPERADMIN' &&
    profile.org_status &&
    profile.org_status !== 'active'
  ) {
    redirect('/auth/pending-approval');
  }

  return (
    <MobileHintProvider isMobile={isMobileUA}>
    <div className="flex h-svh flex-col bg-muted">
      <SidebarProvider
        style={
          {
            '--sidebar-width': '18rem',
            '--sidebar-width-mobile': '18rem',
            minHeight: 0,
            flex: 1,
          } as CSSProperties
        }
      >
        <SidebarSwipeHandler />
        <ProfileProvider profile={profile}>
          {profile.onboarding_status === 'completed' &&
            !profile.workflow_guide_seen &&
            profile.system_role !== 'SUPERADMIN' && (
              <WorkflowGuideModal defaultOpen />
            )}
          <SupportAccessRealtime />
          <SupportSessionTracker />
          <AppSidebar />
          <main data-cobrowse="main" className="relative flex flex-1 flex-col overflow-auto bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-sm">
            <SuperAdminBanner profile={profile} />
            <SupportAccessBanner profile={profile} />
            <EmailConnectionBanner profile={profile} />
            <PlanUsageBanner profile={profile} />
            <AppNavBar />
            <div data-cobrowse="content" className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-0 md:gap-6 md:py-0">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </ProfileProvider>
      </SidebarProvider>
    </div>
    </MobileHintProvider>
  );
}
