'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock } from 'lucide-react';
import { getEmailFollowUps, type EmailFollowUpView } from '@/app/[locale]/(dashboard)/legal-process/signature-actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
}

export function FollowUpStatus({ legalProcessId, refreshKey }: Props) {
  const t = useTranslations('process.follow_up');
  const [items, setItems] = useState<EmailFollowUpView[]>([]);

  useEffect(() => {
    getEmailFollowUps(legalProcessId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [legalProcessId, refreshKey]);

  const pending = items.filter((item) => item.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('title')}</p>
      <div className="flex flex-col gap-2">
        {pending.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
              item.overdue
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/30 dark:text-red-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {item.overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {item.to_email}
            </span>
            <span>{item.overdue ? t('overdue') : t('waiting')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
