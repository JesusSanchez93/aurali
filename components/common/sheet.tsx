import {
  Sheet as SheetUI,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ReactNode } from 'react';

interface Props {
  trigger: ReactNode;
  title: string;
  description?: string;
  className?: string;
  body?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function Sheet({
  trigger,
  title,
  description,
  className,
  body,
  open,
  onOpenChange,
}: Props) {
  return (
    <SheetUI open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetOverlay className="bg-background/10 backdrop-blur-[3px] transition-all duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className={className}>{body}</div>
      </SheetContent>
    </SheetUI>
  );
}
