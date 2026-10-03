'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, X, Loader2, ClipboardList } from 'lucide-react'
import { type PendingOrgRow, approveOrganizationAction, rejectOrganizationAction } from '../actions'
import { toast } from '@/lib/toast'

interface Props {
  orgs: PendingOrgRow[]
}

export function PendingRequestsList({ orgs }: Props) {
  const [reviewingOrgId, setReviewingOrgId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const router = useRouter()
  const pendingCount = orgs.filter((org) => org.status === 'pending').length

  const review = (orgId: string, action: (id: string) => Promise<void>, success: string) => {
    setReviewingOrgId(orgId)
    startTransition(async () => {
      try {
        await action(orgId)
        toast.success(success)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción')
      } finally {
        setReviewingOrgId(null)
      }
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
            {pendingCount} {pendingCount === 1 ? 'organización esperando revisión' : 'organizaciones esperando revisión'}
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
                  {org.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                </Badge>
                <div className="flex items-center gap-1.5">
                  {/* Una rechazada solo puede aprobarse después (rechazarla otra vez no cambia nada). */}
                  {org.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => review(org.id, rejectOrganizationAction, 'Solicitud rechazada')}
                      disabled={isPending}
                    >
                      {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      Rechazar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => review(org.id, approveOrganizationAction, 'Organización aprobada')}
                    disabled={isPending}
                  >
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
