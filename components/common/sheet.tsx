'use client';

import {
  Sheet as SheetUI,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { ReactNode, useRef, useState } from 'react';

interface Props {
  trigger?: ReactNode;
  title: ReactNode;
  description?: string;
  className?: string;
  body?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  stickyHeader?: boolean;
  stickyFooter?: boolean;
}

export default function Sheet({
  trigger,
  title,
  description,
  className,
  body,
  footer,
  open,
  onOpenChange,
  size,
  stickyHeader = false,
  stickyFooter = false,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    setScrolled((bodyRef.current?.scrollTop ?? 0) > 0);
  };

  return (
    <SheetUI open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent size={size} className='p-0 gap-0 [&>button]:hidden'>
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          className={cn('flex flex-1 flex-col min-h-0 overflow-y-auto', className)}
        >
          <SheetHeader className={cn(
            'p-4 z-10 bg-background transition-shadow duration-200',
            stickyHeader && 'sticky top-0',
            stickyHeader && scrolled && 'shadow-[0_6px_16px_-4px_hsl(var(--foreground)/0.14)]',
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <SheetTitle>{title}</SheetTitle>
                {description && <SheetDescription>{description}</SheetDescription>}
              </div>
              <SheetClose className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
          </SheetHeader>
          {body}
          {footer && (
            <div className={cn(
              'p-4 bg-background',
              stickyFooter && 'sticky bottom-0',
            )}>
              {footer}
            </div>
          )}
        </div>
      </SheetContent>
    </SheetUI>
  );
}
