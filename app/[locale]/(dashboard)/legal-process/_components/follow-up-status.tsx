'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { getEmailFollowUps, type EmailFollowUpView } from '@/app/[locale]/(dashboard)/legal-process/signature-actions';
import { syncEmailFollowUpAction } from '@/app/[locale]/(dashboard)/legal-process/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
  /** Refresca los datos del proceso (adjuntos incluidos) tras una sincronización exitosa. */
  onSynced?: () => void;
}

export function FollowUpStatus({ legalProcessId, refreshKey, onSynced }: Props) {
  const t = useTranslations('process.follow_up');
  const [items, setItems] = useState<EmailFollowUpView[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    getEmailFollowUps(legalProcessId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [legalProcessId, refreshKey]);

  const pending = items.filter((item) => item.status === 'pending');
  if (pending.length === 0) return null;

  const handleSync = async (item: EmailFollowUpView) => {
    setSyncingId(item.id);
    try {
      const { found } = await syncEmailFollowUpAction(item.id, legalProcessId);
      toast.success(found ? t('sync_found') : t('sync_not_found'));
      if (found) onSynced?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sync_error'));
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('title')}</p>
      <div className="flex flex-col gap-2">
        {pending.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
              item.overdue
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {item.overdue ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{item.to_email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span>{item.overdue ? t('overdue') : t('waiting')}</span>
              {item.syncable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={syncingId === item.id}
                  onClick={() => handleSync(item)}
                >
                  <RefreshCw className={`h-3 w-3 ${syncingId === item.id ? 'animate-spin' : ''}`} />
                  {t('sync_now')}
                </Button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
