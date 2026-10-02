import { Building2, CreditCard, Landmark } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BillingOverview, BillingTransferInfo, PaymentHistoryRow } from '../actions'

interface Props {
  overview: BillingOverview
  transferInfo: BillingTransferInfo | null
  payments: PaymentHistoryRow[]
}

const STATUS_LABEL: Record<string, string> = {
  trial: 'Prueba',
  active: 'Activa',
  past_due: 'Vencida',
  canceled: 'Cancelada',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  trial: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  past_due: 'bg-destructive/15 text-destructive',
  canceled: 'bg-muted text-muted-foreground',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin vencimiento'
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit !== null && limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const level = limit === null ? 'ok' : used >= limit ? 'over' : used >= limit * 0.8 ? 'warn80' : 'ok'
  const barClass = level === 'over' ? 'bg-destructive' : level === 'warn80' ? 'bg-amber-500' : 'bg-primary'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs">{Math.round(used)}{limit !== null ? ` / ${limit}` : ' (ilimitado)'}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        {limit !== null && <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  )
}

export function BillingSection({ overview, transferInfo, payments }: Props) {
  const { plan, usage } = overview
  const vencimiento = plan.status === 'trial' ? plan.trialEndsAt : plan.currentPeriodEnd

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Plan y facturación</h1>
        <p className="text-sm text-muted-foreground">Tu plan actual, uso del mes y pagos registrados.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <span className="text-sm font-medium text-muted-foreground">Plan actual</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{plan.plan.name}</span>
            <Badge className={STATUS_BADGE_CLASS[plan.status]}>{STATUS_LABEL[plan.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.status === 'trial' ? 'Fin de la prueba' : 'Próximo vencimiento'}: {formatDate(vencimiento)}
          </p>

          <div className="space-y-3 pt-2">
            <UsageBar label="Procesos nuevos este mes" used={usage.processes} limit={plan.plan.maxMonthlyProcesses} />
            <UsageBar label="Usuarios" used={usage.users} limit={plan.plan.maxUsers} />
            <UsageBar label="Almacenamiento (GB)" used={usage.storageGb} limit={plan.plan.maxStorageGb} />
          </div>
        </CardContent>
      </Card>

      {transferInfo && (
        <Card>
          <CardHeader className="pb-3">
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Landmark className="h-4 w-4" />
              Datos para transferencia
            </span>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p><span className="text-muted-foreground">Banco:</span> {transferInfo.bankName}</p>
            <p><span className="text-muted-foreground">Tipo de cuenta:</span> {transferInfo.accountType}</p>
            <p><span className="text-muted-foreground">Número de cuenta:</span> {transferInfo.accountNumber}</p>
            <p><span className="text-muted-foreground">Titular:</span> {transferInfo.accountHolder}</p>
            <p className="pt-1 text-xs text-muted-foreground">
              Envía el comprobante a <span className="font-medium">{transferInfo.contactEmail}</span> para que registremos tu pago.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Historial de pagos
          </span>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Building2 className="mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">Todavía no hay pagos registrados.</p>
            </div>
          ) : (
            <div className="divide-y">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatUsd(p.amountUsdCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.invoiceNumber ? `Factura ${p.invoiceNumber}` : 'Sin número de factura'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
