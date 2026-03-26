import {
  Sheet as SheetUI,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface Props {
  trigger: ReactNode;
  title: ReactNode;
  description?: string;
  className?: string;
  body?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export default function Sheet({
  trigger,
  title,
  description,
  className,
  body,
  open,
  onOpenChange,
  size,
}: Props) {
  return (
    <SheetUI open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetOverlay className="bg-background/5 backdrop-blur-[3px] transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <SheetContent size={size} className='p-0'>
        <SheetHeader className='p-4 pb-0'>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className={cn('flex flex-1 min-h-0 overflow-auto', className)}>{body}</div>
      </SheetContent>
    </SheetUI>
  );
}
