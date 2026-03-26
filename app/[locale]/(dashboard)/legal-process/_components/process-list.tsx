'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database.types';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Mail, Phone, CalendarDays, Loader2 } from 'lucide-react';
import ProcessDetailSheet from '@/app/[locale]/(dashboard)/legal-process/_components/process-detail-sheet';
import { ProcessTimelineButton } from '@/app/[locale]/(dashboard)/legal-process/_components/process-timeline-dialog';

type LegalProcess = Database['public']['Tables']['legal_processes']['Row'];
type LegalProcessClient = Database['public']['Tables']['legal_process_clients']['Row'];

interface ProcessListProps {
  data: (LegalProcess & {
    client: LegalProcessClient | null;
  })[] | null;
  canViewTimeline?: boolean;
}

export default function ProcessList({ data }: ProcessListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('process.list');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const selectedId = searchParams.get('id');

  useEffect(() => {
    if (selectedId) setLoadingId(null);
  }, [selectedId]);

  const handleOpen = (processId: string) => {
    setLoadingId(processId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('id', processId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('id');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  if (!data || data.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <div className="text-muted-foreground">{t('empty_title')}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('empty_desc')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-7 md:grid-cols-1">
        {data.map((process, index) => (
          <ProcessCard
            key={process.id}
            process={process}
            index={index}
            onSelect={handleOpen}
            isLoading={loadingId === process.id}
          />
        ))}
      </div>

      <ProcessDetailSheet
        processId={selectedId}
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      />
    </div>
  );
}

function ProcessCard({ process, index, onSelect, isLoading }: {
  process: LegalProcess & {
    client: LegalProcessClient | null;
  };
  index: number;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const t = useTranslations('process');
  const listT = useTranslations('process.list');
  const isDraft = process.status === 'draft';

  const clientName = [process.client?.first_name, process.client?.last_name]
    .filter(Boolean)
    .join(' ') || listT('no_name');

  return (
    <div
      onClick={() => !isDraft && onSelect(process.id)}
      className={`group relative rounded-xl border bg-card text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards ${!isDraft ? 'hover:shadow-md cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-row gap-3 p-5 relative">
        <div className="absolute top-[-11px] flex items-center gap-1.5">
          <Badge variant={isDraft ? 'secondary' : 'default'} className="capitalize font-mono">
            {t(`status.${process.status ?? 'draft'}`)}
          </Badge>
          {isLoading && (
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${isDraft ? 'bg-secondary' : 'bg-primary'}`}>
              <Loader2 className={`h-3 w-3 animate-spin ${isDraft ? 'text-secondary-foreground' : 'text-primary-foreground'}`} />
            </span>
          )}
        </div>

        <div className='flex-1'>
          {/* Client name — protagonist */}
          <h3 className="uppercase truncate text-xl font-bold leading-tight tracking-tight">
            {clientName}
          </h3>

          {/* Contact details */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-2">
            {process.client?.email && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{process.client.email}</span>
              </span>
            )}
            {process.client?.phone && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {process.client.phone}
              </span>
            )}
          </div>

          {/* Date — bottom */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {process.created_at
              ? new Date(process.created_at).toLocaleDateString('es', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              : '—'}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ProcessTimelineButton
            legalProcessId={process.id}
            clientEmail={process.client?.email}
          />
        </div>
      </div>
    </div>
  );
}
