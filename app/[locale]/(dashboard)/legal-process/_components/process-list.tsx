'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database.types';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Phone, CalendarDays, Loader2, MoreHorizontal, Archive, XCircle, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ActionReasonDialog } from '@/components/common/action-reason-dialog';
import ProcessDetailSheet from '@/app/[locale]/(dashboard)/legal-process/_components/process-detail-sheet';
import { ProcessTimelineButton } from '@/app/[locale]/(dashboard)/legal-process/_components/process-timeline-dialog';
import {
  archiveLegalProcess,
  declineLegalProcess,
  revertArchivedProcess,
} from '@/app/[locale]/(dashboard)/legal-process/actions';

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

  const handleRefresh = () => router.refresh();

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
            onRefresh={handleRefresh}
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

const STATUS_STYLE: Record<string, { bg: string; border: string; shadow: string; hover: string; badge: string }> = {
  draft:               { bg: '',                                         border: 'border-slate-200 dark:border-slate-700',       shadow: 'shadow-slate-200/60 dark:shadow-slate-900/40',     hover: 'hover:border-slate-100 hover:shadow-md hover:shadow-slate-100/60 dark:hover:border-slate-800',         badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  pending_client_data: { bg: 'bg-amber-50/40 dark:bg-amber-950/20',     border: 'border-amber-200 dark:border-amber-800/60',    shadow: 'shadow-amber-200/60 dark:shadow-amber-900/40',     hover: 'hover:border-amber-100 hover:shadow-md hover:shadow-amber-100/60 dark:hover:border-amber-900',         badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200' },
  completed:           { bg: 'bg-blue-50/40 dark:bg-blue-950/20',       border: 'border-blue-200 dark:border-blue-800/60',      shadow: 'shadow-blue-200/60 dark:shadow-blue-900/40',       hover: 'hover:border-blue-100 hover:shadow-md hover:shadow-blue-100/60 dark:hover:border-blue-900',             badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' },
  approved:            { bg: 'bg-green-50/40 dark:bg-green-950/20',     border: 'border-green-200 dark:border-green-800/60',    shadow: 'shadow-green-200/60 dark:shadow-green-900/40',     hover: 'hover:border-green-100 hover:shadow-md hover:shadow-green-100/60 dark:hover:border-green-900',           badge: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200' },
  paid:                { bg: 'bg-emerald-50/40 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800/60', shadow: 'shadow-emerald-200/60 dark:shadow-emerald-900/40', hover: 'hover:border-emerald-100 hover:shadow-md hover:shadow-emerald-100/60 dark:hover:border-emerald-900',     badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' },
  documents_approved:  { bg: 'bg-teal-50/40 dark:bg-teal-950/20',      border: 'border-teal-200 dark:border-teal-800/60',      shadow: 'shadow-teal-200/60 dark:shadow-teal-900/40',       hover: 'hover:border-teal-100 hover:shadow-md hover:shadow-teal-100/60 dark:hover:border-teal-900',             badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200' },
  documents_sent:      { bg: 'bg-sky-50/40 dark:bg-sky-950/20',        border: 'border-sky-200 dark:border-sky-800/60',        shadow: 'shadow-sky-200/60 dark:shadow-sky-900/40',         hover: 'hover:border-sky-100 hover:shadow-md hover:shadow-sky-100/60 dark:hover:border-sky-900',                 badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200' },
  documents_received:  { bg: 'bg-indigo-50/40 dark:bg-indigo-950/20',  border: 'border-indigo-200 dark:border-indigo-800/60',  shadow: 'shadow-indigo-200/60 dark:shadow-indigo-900/40',   hover: 'hover:border-indigo-100 hover:shadow-md hover:shadow-indigo-100/60 dark:hover:border-indigo-900',       badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200' },
  finished:            { bg: 'bg-purple-50/40 dark:bg-purple-950/20',  border: 'border-purple-200 dark:border-purple-800/60',  shadow: 'shadow-purple-200/60 dark:shadow-purple-900/40',   hover: 'hover:border-purple-100 hover:shadow-md hover:shadow-purple-100/60 dark:hover:border-purple-900',       badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200' },
  archived:            { bg: 'bg-zinc-50/40 dark:bg-zinc-950/20',      border: 'border-zinc-300 dark:border-zinc-700',         shadow: 'shadow-zinc-200/60 dark:shadow-zinc-900/40',       hover: 'hover:border-zinc-200 hover:shadow-md hover:shadow-zinc-100/60 dark:hover:border-zinc-800',             badge: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' },
  declined:            { bg: 'bg-red-50/40 dark:bg-red-950/20',        border: 'border-red-200 dark:border-red-800/60',        shadow: 'shadow-red-200/60 dark:shadow-red-900/40',         hover: 'hover:border-red-100 hover:shadow-md hover:shadow-red-100/60 dark:hover:border-red-900',                 badge: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' },
};

function ProcessCard({ process, index, onSelect, isLoading, onRefresh }: {
  process: LegalProcess & { client: LegalProcessClient | null };
  index: number;
  onSelect: (id: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations('process');
  const listT = useTranslations('process.list');
  const commonT = useTranslations('common');

  const [archiveConfirming, setArchiveConfirming] = useState(false);
  const [declineConfirming, setDeclineConfirming] = useState(false);
  const [revertConfirming, setRevertConfirming] = useState(false);
  const [actioning, setActioning] = useState(false);

  const status = process.status ?? 'draft';
  const isDraft = status === 'draft';
  const isFinished = status === 'finished';
  const isArchived = status === 'archived';
  const isDeclined = status === 'declined';
  const isTerminal = isFinished || isDeclined; // archived is NOT terminal — it can be reverted
  const showDropdown = !isFinished && !isDeclined; // show for active + archived

  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.draft;

  const clientName = [process.client?.first_name, process.client?.last_name]
    .filter(Boolean)
    .join(' ') || listT('no_name');

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    setActioning(true);
    try {
      await fn();
      toast.success(successMsg);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : commonT('error'));
    } finally {
      setActioning(false);
    }
  };

  const handleArchiveWithNote = (note: string) =>
    runAction(() => archiveLegalProcess(process.id, note || undefined), t('archive.success'));

  const handleDeclineWithNote = (note: string) =>
    runAction(() => declineLegalProcess(process.id, note || undefined), t('decline.success'));

  return (
    <>
      <div
        onClick={() => !isDraft && onSelect(process.id)}
        className={`group relative rounded-xl border bg-card text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards ${statusStyle.bg} ${statusStyle.border} ${statusStyle.shadow} ${!isDraft ? `cursor-pointer ${statusStyle.hover}` : ''}`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="flex flex-col gap-3 p-5 relative sm:flex-row">
          <div className="absolute top-[-11px] flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono border-transparent bg-muted text-muted-foreground text-[10px] px-1.5">
              #{String(process.process_number).padStart(4, '0')}
            </Badge>
            <Badge variant="outline" className={`capitalize font-mono border-transparent ${statusStyle.badge}`}>
              {t(`status.${status}`)}
            </Badge>
            {isLoading && (
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary">
                <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
              </span>
            )}
          </div>

          <div className="flex-1">
            <h3 className={`uppercase truncate text-xl font-bold leading-tight tracking-tight ${isDraft ? 'text-muted-foreground' : ''}`}>
              {clientName}
            </h3>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2">
              {process.client?.email && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
                  <span className="truncate">{process.client.email}</span>
                </span>
              )}
              {process.client?.phone && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
                  {process.client.phone}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1.5">
              <CalendarDays className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
              {process.created_at
                ? new Date(process.created_at).toLocaleDateString('es', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })
                : '—'}
            </div>
          </div>

          <div className="flex flex-row gap-1 items-center justify-end sm:flex-col sm:items-end sm:justify-start" onClick={(e) => e.stopPropagation()}>
            <ProcessTimelineButton
              legalProcessId={process.id}
              clientEmail={process.client?.email}
              className={statusStyle.badge}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!showDropdown}>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-11 w-11 p-0 border-transparent sm:h-7 sm:w-7 ${showDropdown ? statusStyle.badge : 'invisible'}`}
                  disabled={actioning || !showDropdown}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isArchived ? (
                    <DropdownMenuItem
                      onClick={() => setRevertConfirming(true)}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t('archive.revert_trigger')}
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => setArchiveConfirming(true)}
                        className="gap-2"
                      >
                        <Archive className="h-4 w-4" />
                        {t('archive.trigger')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeclineConfirming(true)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                        {t('decline.trigger')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>
      </div>

      <ActionReasonDialog
        isOpen={archiveConfirming}
        onClose={() => setArchiveConfirming(false)}
        onConfirm={handleArchiveWithNote}
        title={t('archive.confirm_title')}
        description={t('archive.confirm_description')}
        reasonLabel={t('archive.note_label')}
        reasonPlaceholder={t('archive.note_placeholder')}
        confirmLabel={t('archive.confirm_button')}
        cancelLabel={t('archive.cancel_button')}
      />
      <ActionReasonDialog
        isOpen={declineConfirming}
        onClose={() => setDeclineConfirming(false)}
        onConfirm={handleDeclineWithNote}
        title={t('decline.confirm_title')}
        description={t('decline.confirm_description')}
        reasonLabel={t('decline.note_label')}
        reasonPlaceholder={t('decline.note_placeholder')}
        confirmLabel={t('decline.confirm_button')}
        cancelLabel={t('decline.cancel_button')}
        variant="destructive"
      />
      <ConfirmDialog
        isOpen={revertConfirming}
        onClose={() => setRevertConfirming(false)}
        onConfirm={() => runAction(
          () => revertArchivedProcess(process.id),
          t('archive.revert_success'),
        )}
        title={t('archive.revert_confirm_title')}
        description={t('archive.revert_confirm_description')}
        confirmLabel={t('archive.revert_confirm_button')}
        cancelLabel={t('archive.cancel_button')}
      />
    </>
  );
}
