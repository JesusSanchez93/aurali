'use client';

import { usePathname } from 'next/navigation';
import { ModeToggle } from './mode-toggle';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { items } from './app-sidebar';

export function AppNavBar() {
  const pathname = usePathname();

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="mx-2 shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-4 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px"
        />
        {items.find((e) => pathname.startsWith(e.url))?.title}
        <div className="flex-auto" />
        <ModeToggle />
      </div>
    </header>
  );
}
