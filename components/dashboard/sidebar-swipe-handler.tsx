'use client';

import { useSidebarSwipe } from '@/hooks/use-sidebar-swipe';

/**
 * Invisible component that registers swipe-to-open/close gesture for the
 * mobile sidebar. Must be rendered inside <SidebarProvider>.
 */
export function SidebarSwipeHandler() {
  useSidebarSwipe();
  return null;
}
