'use client';

import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database.types';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import ProcessDetailSheet from '@/app/[locale]/(dashboard)/legal-process/_components/process-detail-sheet';

type LegalProcess = Database['public']['Tables']['legal_processes']['Row'];
type LegalProcessClient = Database['public']['Tables']['legal_process_clients']['Row'];

interface ProcessListProps {
  data: (LegalProcess & {
    client: LegalProcessClient | null;
  })[] | null;
}

export default function ProcessList({ data }: ProcessListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('process.list');

  const selectedId = searchParams.get('id');

  const handleOpen = (processId: string) => {
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
      <div className="grid gap-4 md:grid-cols-1">
        {data.map((process, index) => (
          <ProcessCard
            key={process.id}
            process={process}
            index={index}
            onSelect={handleOpen}
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

function ProcessCard({ process, index, onSelect }: {
  process: LegalProcess & {
    client: LegalProcessClient | null;
  };
  index: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('process');
  const listT = useTranslations('process.list');
  const isDraft = process.status === 'draft';

  const cardContent = (
    <div className="p-5">
      <div className="flex items-center space-x-4">
        <Badge
          variant={isDraft ? 'secondary' : 'default'}
          className="capitalize"
        >
          {t(`status.${process.status ?? 'draft'}`)}
        </Badge>
        <div>
          <h3
            className="truncate font-semibold leading-none tracking-tight"
            title={process?.client?.email || ''}
          >
            {process?.client?.email || listT('no_email')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {listT('created')}{' '}
            {process.created_at
              ? new Date(process.created_at).toLocaleDateString()
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div
      onClick={() => !isDraft && onSelect(process.id)}
      className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards ${!isDraft ? 'hover:shadow-md cursor-pointer' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {cardContent}
    </div>
  );
}
