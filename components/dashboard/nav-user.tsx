'use client';

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { logoutAction } from '@/app/[locale]/auth/actions';
import { exitOrganizationAction } from '@/app/[locale]/(dashboard)/admin/clients/actions';
import Link from 'next/link';
import { useProfile } from '@/components/providers/profile-provider';
import { useTranslations } from 'next-intl';

export function NavUser() {
  const t = useTranslations('common.nav.user');
  const profile = useProfile();
  const { isMobile } = useSidebar();

  const initials =
    profile.firstname[0]?.toUpperCase() + profile.lastname[0]?.toUpperCase();
  const fullName = profile.firstname + ' ' + profile.lastname;

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
  const isInsideOrg = isSuperAdmin && !!profile?.current_organization_id;

  const logout = async () => {
    await logoutAction();
  };

  const exitOrg = async () => {
    await exitOrganizationAction();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="border data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{fullName}</span>
                <span className="truncate text-xs">{profile.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{fullName}</span>
                  <span className="truncate text-xs">{profile.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <Sparkles />
                {t('upgrade')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={'/account'}>
                  <BadgeCheck />
                  {t('account')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CreditCard />
                {t('billing')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Bell />
                {t('notifications')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {isInsideOrg && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={exitOrg}
                  className="cursor-pointer text-muted-foreground"
                >
                  <ArrowLeft />
                  {t('exit_organization')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive hover:bg-destructive/10 focus:text-destructive dark:hover:bg-destructive/20"
            >
              <LogOut />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
