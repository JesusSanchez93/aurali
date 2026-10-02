'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import Sheet from '@/components/common/sheet';
import { ProcessPaymentsSection } from '@/app/[locale]/(dashboard)/legal-process/_components/process-payments-section';
import { getProcessFeeAndPayments } from '@/app/[locale]/(dashboard)/legal-process/actions';

interface Props {
  legalProcessId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeePayments = Awaited<ReturnType<typeof getProcessFeeAndPayments>>;

export function PaymentManagementSheet({ legalProcessId, open, onOpenChange }: Props) {
  const t = useTranslations('payments');
  const router = useRouter();
  const [data, setData] = useState<FeePayments | null>(null);
  // Arranca en `true`: este componente se remonta por completo cuando cambia
  // el proceso seleccionado (ver `key` en payments-list.tsx), así que el
  // primer render siempre necesita cargar.
  const [loading, setLoading] = useState(true);

  function reload() {
    if (!legalProcessId) return;
    setLoading(true);
    getProcessFeeAndPayments(legalProcessId)
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!legalProcessId) return;
    getProcessFeeAndPayments(legalProcessId)
      .then(setData)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalProcessId]);

  if (!legalProcessId) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('manage_title')}
      body={
        loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-4">
            <ProcessPaymentsSection
              legalProcessId={legalProcessId}
              fee={data?.fee ?? null}
              payments={data?.payments ?? []}
              onUpdate={() => {
                reload();
                router.refresh();
              }}
            />
          </div>
        )
      }
    />
  );
}
