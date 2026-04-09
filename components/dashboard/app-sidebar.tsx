'use client';

import { Home, Scale, Settings, Users, ShieldCheck, BookOpen, FileText, Sparkles } from 'lucide-react';
import { Logo } from '@/components/common/logo';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Link, usePathname } from '@/i18n/routing';
import { NavUser } from './nav-user';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/components/providers/profile-provider';

export const userItems = [
  { titleKey: 'home',      url: '/dashboard',          icon: Home },
  { titleKey: 'processes', url: '/legal-process',      icon: Scale },
  { titleKey: 'clients',   url: '/clients',            icon: Users },
  { titleKey: 'settings',  url: '/settings/workflows', icon: Settings },
];

export const adminUserItems = [
  { titleKey: 'home',         url: '/dashboard',               icon: Home },
  { titleKey: 'processes',    url: '/legal-process',           icon: Scale },
  { titleKey: 'clients',      url: '/clients',                 icon: Users },
  { titleKey: 'users',        url: '/settings/users',          icon: Users },
  { titleKey: 'documents',    url: '/settings/documents',      icon: FileText },
  { titleKey: 'ai_variables', url: '/settings/ai-variables',   icon: Sparkles },
  { titleKey: 'settings',     url: '/settings/workflows',      icon: Settings },
];

export const adminItems = [
  { titleKey: 'home',            url: '/dashboard',       icon: Home },
  { titleKey: 'admin_clients',   url: '/admin/clients',   icon: Users },
  { titleKey: 'workflows',       url: '/admin/workflows', icon: ShieldCheck },
  { titleKey: 'catalog',         url: '/admin/catalog',   icon: BookOpen },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations('common.nav');
  const profile = useProfile();
  const { setOpenMobile, isMobile } = useSidebar();

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
  const isImpersonating = isSuperAdmin && !!profile?.current_organization_id;
  const isOrgAdmin = profile?.org_role === 'ORG_ADMIN';
  const items = isSuperAdmin && !isImpersonating
    ? adminItems
    : isOrgAdmin
      ? adminUserItems
      : userItems;

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 py-3">
        <Logo size={22} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url + '/');

                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      size={isMobile ? 'lg' : 'default'}
                    >
                      <Link
                        href={item.url}
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <item.icon />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
