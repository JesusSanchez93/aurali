'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import Sheet from '@/components/common/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Form } from '@/components/ui/form'
import { FormInput } from '@/components/common/form/form-input'
import { FormDatePicker } from '@/components/common/form/form-date-picker'
import { toast } from '@/lib/toast'
import {
  activateSubscription,
  changeAgreedPrice,
  changeSubscriptionPlan,
  extendSubscription,
  getPaymentHistory,
  registerPayment,
  type OrgBillingRow,
  type PaymentHistoryRow,
  type PlanOption,
} from '../actions'

interface Props {
  org: OrgBillingRow | null
  plans: PlanOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const paymentFormSchema = z.object({
  amountUsd: z.coerce.number({ invalid_type_error: 'Ingresa el monto en USD.' }).positive('El monto debe ser mayor a 0.'),
  amountCop: z.coerce.number().positive().optional().or(z.literal('' as unknown as number)),
  trmUsed: z.coerce.number().positive().optional().or(z.literal('' as unknown as number)),
  reference: z.string().trim().max(120).optional(),
  invoiceNumber: z.string().trim().max(120).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
})

type PaymentFormValues = z.infer<typeof paymentFormSchema>

function formatUsd(cents: number | null): string {
  if (cents === null) return '—'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function OrgBillingSheet({ org, plans, open, onOpenChange }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Este componente se remonta por completo cuando cambia la organización
  // seleccionada (ver `key` en billing-org-list.tsx), así que el estado
  // local puede inicializarse directamente desde `org` sin un efecto.
  const [planId, setPlanId] = useState(org?.planId ?? '')
  const [agreedPriceUsd, setAgreedPriceUsd] = useState(
    org?.agreedPriceCents !== null && org?.agreedPriceCents !== undefined ? (org.agreedPriceCents / 100).toString() : '',
  )
  const [newPeriodEnd, setNewPeriodEnd] = useState('')
  const [history, setHistory] = useState<PaymentHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amountUsd: undefined,
      amountCop: '' as unknown as number,
      trmUsed: '' as unknown as number,
      reference: '',
      invoiceNumber: '',
      notes: '',
      periodStart: '',
      periodEnd: '',
    },
  })

  useEffect(() => {
    if (!org) return
    getPaymentHistory(org.subscriptionId)
      .then(setHistory)
      .finally(() => setLoadingHistory(false))
  }, [org])

  if (!org) return null

  function handleActivate() {
    if (!org) return
    startTransition(async () => {
      try {
        await activateSubscription(org.subscriptionId)
        toast.success('Suscripción activada')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al activar')
      }
    })
  }

  function handleChangePlan(value: string) {
    if (!org) return
    setPlanId(value)
    startTransition(async () => {
      try {
        await changeSubscriptionPlan(org.subscriptionId, value)
        toast.success('Plan actualizado')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cambiar el plan')
      }
    })
  }

  function handleChangePrice() {
    if (!org) return
    const cents = agreedPriceUsd.trim() ? Math.round(Number(agreedPriceUsd) * 100) : null
    startTransition(async () => {
      try {
        await changeAgreedPrice(org.subscriptionId, cents)
        toast.success('Precio pactado actualizado')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cambiar el precio')
      }
    })
  }

  function handleExtend() {
    if (!org || !newPeriodEnd) return
    startTransition(async () => {
      try {
        await extendSubscription(org.subscriptionId, new Date(newPeriodEnd).toISOString())
        toast.success('Vencimiento actualizado')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al extender el vencimiento')
      }
    })
  }

  function handleRegisterPayment(values: PaymentFormValues) {
    if (!org) return
    startTransition(async () => {
      try {
        await registerPayment({
          organizationId: org.organizationId,
          subscriptionId: org.subscriptionId,
          amountUsdCents: Math.round(values.amountUsd * 100),
          amountCop: values.amountCop ? Number(values.amountCop) : undefined,
          trmUsed: values.trmUsed ? Number(values.trmUsed) : undefined,
          reference: values.reference || undefined,
          invoiceNumber: values.invoiceNumber || undefined,
          periodStart: values.periodStart || undefined,
          periodEnd: values.periodEnd || undefined,
          notes: values.notes || undefined,
        })
        toast.success('Pago registrado y suscripción extendida')
        router.refresh()
        paymentForm.reset({
          amountUsd: undefined,
          amountCop: '' as unknown as number,
          trmUsed: '' as unknown as number,
          reference: '',
          invoiceNumber: '',
          notes: '',
          periodStart: '',
          periodEnd: '',
        })
        const updated = await getPaymentHistory(org.subscriptionId)
        setHistory(updated)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al registrar el pago')
      }
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={org.organizationName ?? 'Organización'}
      description="Plan, estado de la suscripción y registro de pagos."
      body={
        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Plan y estado</h3>

            {org.status !== 'active' && (
              <Button size="sm" onClick={handleActivate} disabled={isPending}>
                Activar suscripción
              </Button>
            )}

            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={handleChangePlan} disabled={isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Precio pactado mensual (USD)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={agreedPriceUsd}
                  onChange={(e) => setAgreedPriceUsd(e.target.value)}
                  placeholder="Precio de lista"
                  disabled={isPending}
                />
                <Button size="sm" variant="outline" onClick={handleChangePrice} disabled={isPending}>Guardar</Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Extender vencimiento a</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                  disabled={isPending}
                />
                <Button size="sm" variant="outline" onClick={handleExtend} disabled={isPending || !newPeriodEnd}>Guardar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Vencimiento actual: {formatDate(org.currentPeriodEnd)}</p>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Registrar pago</h3>
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(handleRegisterPayment)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormInput control={paymentForm.control} name="amountUsd" label="Monto USD" type="number" required disabled={isPending} />
                  <FormInput control={paymentForm.control} name="amountCop" label="Monto COP" type="number" disabled={isPending} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput control={paymentForm.control} name="trmUsed" label="TRM usada" type="number" disabled={isPending} />
                  <FormInput control={paymentForm.control} name="reference" label="Referencia" disabled={isPending} />
                </div>
                <FormInput control={paymentForm.control} name="invoiceNumber" label="Número de factura/cuenta de cobro" disabled={isPending} />
                <div className="grid grid-cols-2 gap-3">
                  <FormDatePicker control={paymentForm.control} name="periodStart" label="Periodo desde" disabled={isPending} />
                  <FormDatePicker control={paymentForm.control} name="periodEnd" label="Periodo hasta" disabled={isPending} />
                </div>
                <FormInput control={paymentForm.control} name="notes" label="Notas" disabled={isPending} />

                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar pago'}
                </Button>
              </form>
            </Form>
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Historial de pagos</h3>
            {loadingHistory ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
            ) : (
              <div className="divide-y rounded-lg border text-sm">
                {history.map((p) => (
                  <div key={p.id} className="flex flex-col gap-0.5 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatUsd(p.amountUsdCents)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[p.reference, p.invoiceNumber].filter(Boolean).join(' · ') || 'Sin referencia'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      }
    />
  )
}
