'use client';

import { usePathname } from '@/i18n/routing';
import { ModeToggle } from './mode-toggle';
import { LanguageSwitcher } from './language-switcher';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { userItems, adminItems, adminUserItems } from './app-sidebar';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/components/providers/profile-provider';
import { ChevronRight } from 'lucide-react';

export function AppNavBar() {
  const pathname = usePathname();
  const t = useTranslations('common.nav');
  const profile = useProfile();

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
  const isImpersonating = isSuperAdmin && !!profile?.current_organization_id;
  const isOrgAdmin = profile?.org_role === 'ORG_ADMIN';
  const items = isSuperAdmin && !isImpersonating
    ? adminItems
    : isOrgAdmin
      ? adminUserItems
      : userItems;

  // Find active parent and optional active sub-item
  let parentItem = items.find((e) => {
    if (e.sub) return e.sub.some((s) => pathname === s.url || pathname.startsWith(s.url + '/'));
    return pathname === e.url || pathname.startsWith(e.url + '/');
  });
  const activeSubItem = parentItem?.sub?.find(
    (s) => pathname === s.url || pathname.startsWith(s.url + '/'),
  );
  // If no sub matched, fall back to a flat match
  if (!parentItem) {
    parentItem = items.find((e) => pathname === e.url || pathname.startsWith(e.url + '/'));
  }

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) sticky top-0 z-20 flex h-[var(--header-height)] shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mx-2 shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-4 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px"
        />
        <nav className="flex items-center gap-1 text-sm" aria-label="breadcrumb">
          {parentItem && (
            <span className={activeSubItem ? 'text-muted-foreground' : 'font-semibold'}>
              {t(parentItem.titleKey)}
            </span>
          )}
          {activeSubItem && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-semibold">{t(activeSubItem.titleKey)}</span>
            </>
          )}
        </nav>
        <div className="flex-auto" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
