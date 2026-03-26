'use client';

import { usePathname } from '@/i18n/routing';
import { ModeToggle } from './mode-toggle';
import { LanguageSwitcher } from './language-switcher';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { userItems, adminItems } from './app-sidebar';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/components/providers/profile-provider';

export function AppNavBar() {
  const pathname = usePathname();
  const t = useTranslations('common.nav');
  const profile = useProfile();

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';
  const isImpersonating = isSuperAdmin && !!profile?.current_organization_id;
  const items = isSuperAdmin && !isImpersonating ? adminItems : userItems;

  const activeItem = items.find((e) => pathname.startsWith(e.url));

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mx-2 shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-4 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px"
        />
        {activeItem ? t(activeItem.titleKey) : ''}
        <div className="flex-auto" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
