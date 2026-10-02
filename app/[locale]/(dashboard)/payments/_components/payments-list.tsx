'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Search, X, CreditCard, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import type { PaymentOverviewRow } from '../actions';
import { PaymentManagementSheet } from './payment-management-sheet';

interface Props {
  rows: PaymentOverviewRow[];
  initialSearch: string;
}

const formatCOP = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);

export function PaymentsList({ rows, initialSearch }: Props) {
  const t = useTranslations('payments');
  const searchT = useTranslations('process.search');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (debouncedSearchTerm === current) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearchTerm) {
      params.set('search', debouncedSearchTerm);
      params.delete('page');
    } else {
      params.delete('search');
    }
    const url = params.size ? `${pathname}?${params.toString()}` : pathname;
    router.push(url, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchT('placeholder')}
          className="pl-9 pr-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors sm:right-1 sm:h-7 sm:w-7"
            aria-label={searchT('clear')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
          <Building2 className="mb-4 h-10 w-10 opacity-30" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {rows.map((row) => {
            const hasFee = row.feeTotal !== null;
            const isFullyPaid = hasFee && row.paidAmount >= (row.feeTotal ?? 0);
            return (
              <div key={row.legalProcessId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{row.clientName}</p>
                    {row.processNumber !== null && (
                      <Badge variant="outline" className="text-[10px]">#{String(row.processNumber).padStart(4, '0')}</Badge>
                    )}
                    {!hasFee ? (
                      <Badge variant="secondary" className="text-[10px]">{t('no_fee_badge')}</Badge>
                    ) : isFullyPaid ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200 text-[10px]">{t('paid_badge')}</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 text-[10px]">{t('pending_badge')}</Badge>
                    )}
                  </div>
                  {row.clientEmail && <p className="truncate text-xs text-muted-foreground">{row.clientEmail}</p>}
                  {hasFee && (
                    <p className="mt-1 text-xs font-mono text-muted-foreground">
                      {formatCOP(row.paidAmount)} / {formatCOP(row.feeTotal ?? 0)}
                    </p>
                  )}
                </div>

                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setSelectedProcessId(row.legalProcessId)}>
                  <CreditCard className="h-3.5 w-3.5" />
                  {t('manage_btn')}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <PaymentManagementSheet
        key={selectedProcessId ?? 'none'}
        legalProcessId={selectedProcessId}
        open={selectedProcessId !== null}
        onOpenChange={(open) => !open && setSelectedProcessId(null)}
      />
    </div>
  );
}
