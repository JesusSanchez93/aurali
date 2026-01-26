import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppNavBar } from '@/components/dashboard/app-navbar';
import { CSSProperties, ReactNode, Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import ProfileProvider from '@/components/providers/profile-provider';

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props) {
  const { user, profile } = await getSessionProfile();

  // if (!user) {
  //   redirect('/auth/login');
  // }

  // if (user && profile?.onboarding_status !== 'completed') {
  //   redirect('/onboarding');
  // }

  if (!profile?.id) return <div>Loading...</div>;

  return (
    <div className="flex min-h-screen bg-muted">
      <SidebarProvider
        style={
          {
            '--sidebar-width': '18rem',
            '--sidebar-width-mobile': '18rem',
          } as CSSProperties
        }
      >
        <ProfileProvider profile={profile}>
          <AppSidebar />
          <main className="relative flex flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow-sm">
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
