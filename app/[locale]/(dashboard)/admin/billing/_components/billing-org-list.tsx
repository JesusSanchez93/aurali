'use client'

import { useState } from 'react'
import { Building2, CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OrgBillingRow, PlanOption } from '../actions'
import { OrgBillingSheet } from './org-billing-sheet'

interface Props {
  orgs: OrgBillingRow[]
  plans: PlanOption[]
}

const STATUS_LABEL: Record<OrgBillingRow['status'], string> = {
  trial: 'Prueba',
  active: 'Activa',
  past_due: 'Vencida',
  canceled: 'Cancelada',
}

const STATUS_BADGE_CLASS: Record<OrgBillingRow['status'], string> = {
  trial: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  past_due: 'bg-destructive/15 text-destructive',
  canceled: 'bg-muted text-muted-foreground',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin vencimiento'
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function usageLine(label: string, used: number, limit: number | null): string {
  return `${label}: ${Math.round(used)}${limit !== null ? `/${limit}` : ''}`
}

export function BillingOrgList({ orgs, plans }: Props) {
  // Guarda solo el id, no el objeto — así, tras un router.refresh() (p. ej.
  // después de guardar un cambio), el Sheet recibe el org fresco de `orgs`
  // en vez de la copia capturada en el momento del click.
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const selectedOrg = orgs.find((o) => o.organizationId === selectedOrgId) ?? null

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
        <Building2 className="mb-4 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay organizaciones registradas todavía.</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y rounded-lg border">
        {orgs.map((org) => (
          <div key={org.organizationId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{org.organizationName ?? 'Sin nombre'}</p>
                <Badge variant="outline" className="text-[10px]">{org.planName}</Badge>
                <Badge className={`text-[10px] ${STATUS_BADGE_CLASS[org.status]}`}>{STATUS_LABEL[org.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Vence: {formatDate(org.currentPeriodEnd)}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-mono text-muted-foreground">
                <span>{usageLine('Procesos', org.usage.processes, org.limits.maxMonthlyProcesses)}</span>
                <span>{usageLine('IA', org.usage.aiUses, org.limits.maxMonthlyAiUses)}</span>
                <span>{usageLine('Usuarios', org.usage.users, org.limits.maxUsers)}</span>
                <span>{usageLine('GB', org.usage.storageGb, org.limits.maxStorageGb)}</span>
              </p>
            </div>

            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setSelectedOrgId(org.organizationId)}>
              <CreditCard className="h-3.5 w-3.5" />
              Gestionar
            </Button>
          </div>
        ))}
      </div>

      <OrgBillingSheet
        key={selectedOrgId ?? 'none'}
        org={selectedOrg}
        plans={plans}
        open={selectedOrg !== null}
        onOpenChange={(open) => !open && setSelectedOrgId(null)}
      />
    </>
  )
}
