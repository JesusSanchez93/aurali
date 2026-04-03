'use client';

import { useEffect } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

/** px from the left edge that counts as an "edge swipe" trigger */
const EDGE_THRESHOLD = 30;
/** minimum horizontal distance (px) to register as a swipe */
const SWIPE_THRESHOLD = 60;

/**
 * Attaches touch listeners on the document to open/close the mobile sidebar
 * via swipe gestures:
 *   - Swipe right from the left edge  → open
 *   - Swipe left while sidebar is open → close
 *
 * Must be used inside <SidebarProvider>.
 */
export function useSidebarSwipe() {
  const { openMobile, setOpenMobile, isMobile } = useSidebar();

  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      // Ignore mostly-vertical movements (scroll)
      if (Math.abs(deltaX) < Math.abs(deltaY)) return;

      // Swipe right from left edge → open
      if (!openMobile && startX <= EDGE_THRESHOLD && deltaX > SWIPE_THRESHOLD) {
        setOpenMobile(true);
        return;
      }

      // Swipe left while open → close
      if (openMobile && deltaX < -SWIPE_THRESHOLD) {
        setOpenMobile(false);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile, openMobile, setOpenMobile]);
}
