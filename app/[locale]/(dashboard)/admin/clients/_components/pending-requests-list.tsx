'use client'

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, X, Loader2, ClipboardList } from 'lucide-react'
import { type PendingOrgRow, approveOrganizationAction, rejectOrganizationAction } from '../actions'

interface Props {
  orgs: PendingOrgRow[]
}

export function PendingRequestsList({ orgs }: Props) {
  const [reviewingOrgId, setReviewingOrgId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const approve = (orgId: string) => {
    setReviewingOrgId(orgId)
    startTransition(async () => {
      await approveOrganizationAction(orgId)
      setReviewingOrgId(null)
    })
  }

  const reject = (orgId: string) => {
    setReviewingOrgId(orgId)
    startTransition(async () => {
      await rejectOrganizationAction(orgId)
      setReviewingOrgId(null)
    })
  }

  const creatorName = (org: PendingOrgRow) => {
    const name = [org.created_by_profile?.firstname, org.created_by_profile?.lastname]
      .filter(Boolean)
      .join(' ')
    return name || org.created_by_profile?.email || 'Sin nombre'
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ClipboardList className="size-6 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Solicitudes pendientes</h2>
          <p className="text-sm text-muted-foreground">
            {orgs.length} {orgs.length === 1 ? 'organización esperando revisión' : 'organizaciones esperando revisión'}
          </p>
        </div>
      </div>

      {orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-10 text-muted-foreground">
          <ClipboardList className="size-8 opacity-40" />
          <p className="text-sm">No hay solicitudes pendientes</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border bg-card">
          {orgs.map((org) => {
            const isReviewing = reviewingOrgId === org.id && isPending

            return (
              <div key={org.id} className="flex items-center gap-3 px-4 py-3">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {org.name ?? org.legal_name ?? 'Sin nombre'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {creatorName(org)}
                    {org.legal_representative_name ? ` · Rep. legal: ${org.legal_representative_name}` : ''}
                  </p>
                </div>
                <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: es })}
                </p>
                <Badge variant={org.status === 'rejected' ? 'destructive' : 'secondary'} className="shrink-0">
                  {org.status}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => reject(org.id)} disabled={isPending}>
                    {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                    Rechazar
                  </Button>
                  <Button size="sm" onClick={() => approve(org.id)} disabled={isPending}>
                    {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Aprobar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
