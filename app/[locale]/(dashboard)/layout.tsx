import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppNavBar } from '@/components/dashboard/app-navbar';
import { SuperAdminBanner } from '@/components/dashboard/superadmin-banner';
import { CSSProperties, ReactNode } from 'react';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import ProfileProvider from '@/components/providers/profile-provider';
import { WorkflowGuideModal } from '@/components/app/dashboard/workflow-guide-modal';
import { SidebarSwipeHandler } from '@/components/dashboard/sidebar-swipe-handler';

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props) {
  const { profile } = await getSessionProfile();

  if (!profile?.id) return <div>Loading...</div>;

  return (
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
          <AppSidebar />
          <main className="relative flex flex-1 flex-col overflow-auto bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-sm">
            <SuperAdminBanner profile={profile} />
            <AppNavBar />
            <div className="flex flex-1 flex-col">
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
  );
}
