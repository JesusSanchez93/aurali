'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/common/form/currency-input';
import { registerPayment, type PaymentMethod } from '@/app/[locale]/(dashboard)/legal-process/actions';

const formatCOP = (amount: number | string) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount));

const formatDate = (dateStr: string) =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

type Fee = { id: string; total_amount: number; currency: string; notes: string | null } | null;
type Payment = { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string };

interface Props {
  legalProcessId: string;
  fee: Fee;
  payments: Payment[];
  onUpdate: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'transfer', 'card', 'nequi', 'daviplata', 'other'];

export function ProcessPaymentsSection({ legalProcessId, fee, payments, onUpdate }: Props) {
  const t = useTranslations('process.payments');
  const commonT = useTranslations('common');

  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const paidAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalAmount = fee ? Number(fee.total_amount) : 0;
  const remainingAmount = fee ? Math.max(0, totalAmount - paidAmount) : 0;
  const isFullyPaid = fee !== null && paidAmount >= totalAmount;

  const methodLabel: Record<PaymentMethod, string> = {
    cash: t('method_cash'),
    transfer: t('method_transfer'),
    card: t('method_card'),
    nequi: t('method_nequi'),
    daviplata: t('method_daviplata'),
    other: t('method_other'),
  };

  function resetForm() {
    setAmount(undefined);
    setMethod('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setNotes('');
  }

  function handleSubmit() {
    if (!amount || amount <= 0 || !method) return;

    startTransition(async () => {
      try {
        await registerPayment(legalProcessId, {
          amount,
          paymentMethod: method as PaymentMethod,
          paymentDate,
          reference: reference || undefined,
          notes: notes || undefined,
        });
        toast.success(t('success'));
        setModalOpen(false);
        resetForm();
        onUpdate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : commonT('error_fallback'));
      }
    });
  }

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            {t('section_title')}
          </h4>
          {isFullyPaid && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-200">
              {t('fully_paid_badge')}
            </Badge>
          )}
        </div>

        {!fee ? (
          <p className="text-sm text-muted-foreground">{t('no_fee')}</p>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">{t('total_fee')}</span>
              <span className="font-medium text-right">{formatCOP(totalAmount)}</span>
              <span className="text-muted-foreground">{t('total_paid')}</span>
              <span className="font-medium text-right">{formatCOP(paidAmount)}</span>
              {!isFullyPaid && (
                <>
                  <span className="text-muted-foreground">{t('remaining')}</span>
                  <span className="font-medium text-right text-amber-600 dark:text-amber-400">{formatCOP(remainingAmount)}</span>
                </>
              )}
            </div>

            {payments.length > 0 && (
              <div className="pt-2 space-y-1.5 border-t">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between text-xs gap-2">
                    <div className="text-muted-foreground">
                      <span>{formatDate(p.payment_date)}</span>
                      <span className="mx-1">·</span>
                      <span>{methodLabel[p.payment_method as PaymentMethod] ?? p.payment_method}</span>
                      {p.reference && <span className="ml-1 text-muted-foreground/70">#{p.reference}</span>}
                    </div>
                    <span className="font-medium shrink-0">{formatCOP(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {fee && !isFullyPaid && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalOpen(true)}
          >
            {t('register_btn')}
          </Button>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) resetForm(); setModalOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('modal_title')}</DialogTitle>
            <DialogDescription>{t('modal_description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label>{t('field_amount')} *</Label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                max={remainingAmount || undefined}
                disabled={isPending}
              />
              {remainingAmount > 0 && (
                <p className="text-xs text-muted-foreground">Máximo: {formatCOP(remainingAmount)}</p>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label>{t('field_method')} *</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('field_method')} />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{methodLabel[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>{t('field_date')} *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label>{t('field_reference')}</Label>
              <Input
                placeholder={t('field_reference')}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{t('field_notes')}</Label>
              <Textarea
                placeholder={t('field_notes')}
                maxLength={200}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }} disabled={isPending}>
              {commonT('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !amount || amount <= 0 || !method}
            >
              {isPending ? commonT('loading') : t('register_btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
