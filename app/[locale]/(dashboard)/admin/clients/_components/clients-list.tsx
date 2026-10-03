'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import { useProfile } from '@/components/providers/profile-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  type ClientRow,
  type ClientOrgRow,
  getClientOrganizations,
  requestOrganizationAccess,
  approveOrganizationAction,
  rejectOrganizationAction,
  type AccessMode,
} from '../actions'
import { Building2, Loader2, Check, X, Clock, KeyRound, ChevronDown, Eye } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/lib/toast'

const ORG_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  pending: 'Pendiente',
  rejected: 'Rechazada',
  draft: 'Borrador',
}

interface Props {
  clients: ClientRow[]
}

export function ClientsList({ clients }: Props) {
  const profile = useProfile()
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [orgs, setOrgs] = useState<ClientOrgRow[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [reviewingOrgId, setReviewingOrgId] = useState<string | null>(null)
  const [requestingOrgId, setRequestingOrgId] = useState<string | null>(null)
  const [requestMode, setRequestMode] = useState<AccessMode>('access')
  const [isPending, startTransition] = useTransition()

  // Con el diálogo abierto, una aprobación o un rechazo cambia el botón al
  // instante (Esperando aprobación → Entrar).
  useEffect(() => {
    if (!selectedClient) return
    return subscribeAuthenticated(createClient(), (supabase) =>
      supabase
        // Nombre único por montaje (ver notifications-bell.tsx).
        .channel(`access_requests_dialog:${profile.id}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'organization_access_requests', filter: `requested_by=eq.${profile.id}` },
          () => {
            void getClientOrganizations(selectedClient.id).then(setOrgs)
          },
        ),
    )
  }, [selectedClient, profile.id])

  const openOrgs = async (client: ClientRow) => {
    setSelectedClient(client)
    setLoadingOrgs(true)
    const data = await getClientOrganizations(client.id)
    setOrgs(data)
    setLoadingOrgs(false)
  }

  const submitAccessRequest = (orgId: string) => {
    setRequestingOrgId(orgId)
    startTransition(async () => {
      try {
        const status = await requestOrganizationAccess(orgId, requestMode)
        toast.success(status === 'approved' ? 'Ya tienes acceso aprobado' : 'Solicitud enviada a los administradores')
        if (selectedClient) setOrgs(await getClientOrganizations(selectedClient.id))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
      } finally {
        setRequestingOrgId(null)
      }
    })
  }

  const approveOrg = (orgId: string) => {
    setReviewingOrgId(orgId)
    startTransition(async () => {
      await approveOrganizationAction(orgId)
      if (selectedClient) setOrgs(await getClientOrganizations(selectedClient.id))
      setReviewingOrgId(null)
    })
  }

  const rejectOrg = (orgId: string) => {
    setReviewingOrgId(orgId)
    startTransition(async () => {
      await rejectOrganizationAction(orgId)
      if (selectedClient) setOrgs(await getClientOrganizations(selectedClient.id))
      setReviewingOrgId(null)
    })
  }

  const initials = (client: ClientRow) => {
    const f = client.firstname?.[0] ?? ''
    const l = client.lastname?.[0] ?? ''
    return (f + l).toUpperCase() || '?'
  }

  const fullName = (client: ClientRow) => {
    const name = [client.firstname, client.lastname].filter(Boolean).join(' ')
    return name || 'Sin nombre'
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <Building2 className="size-10 opacity-40" />
        <p>No hay clientes registrados</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-border rounded-lg border bg-card">
        {clients.map((client) => (
          <div
            key={client.id}
            className="flex items-center gap-4 px-6 py-4"
          >
            <Avatar className="size-9">
              <AvatarFallback className="text-sm">{initials(client)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{fullName(client)}</p>
              <p className="text-xs text-muted-foreground truncate">{client.email}</p>
            </div>

            <Badge variant={client.onboarding_status === 'completed' ? 'default' : 'secondary'}>
              {client.onboarding_status === 'completed' ? 'Activo' : 'Incompleto'}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => openOrgs(client)}
              title="Ver organizaciones"
              aria-label="Ver organizaciones"
            >
              <Building2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) setSelectedClient(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Organizaciones de {selectedClient ? fullName(selectedClient) : ''}
            </DialogTitle>
          </DialogHeader>

          {loadingOrgs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Este cliente no tiene organizaciones asignadas.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {orgs.map((membership) => {
                const org = membership.organizations
                if (!org) return null
                const isReviewing = reviewingOrgId === org.id && isPending
                const isPendingApproval = org.status === 'pending' || org.status === 'rejected'

                return (
                  <div key={org.id} className="space-y-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {org.name ?? org.legal_name ?? 'Sin nombre'}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {membership.role.toLowerCase().replace('_', ' ')}
                        </p>
                      </div>
                      <Badge
                        variant={
                          org.status === 'active'
                            ? 'default'
                            : org.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="shrink-0"
                      >
                        {ORG_STATUS_LABELS[org.status ?? 'draft'] ?? org.status}
                      </Badge>
                    </div>
                    {isPendingApproval ? (
                      <div className="flex justify-end gap-1.5">
                        {org.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectOrg(org.id)}
                            disabled={isPending}
                          >
                            {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                            Rechazar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => approveOrg(org.id)}
                          disabled={isPending}
                        >
                          {isReviewing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Aprobar
                        </Button>
                      </div>
                    ) : membership.access === 'approved' ? (
                      // Al aprobarse entra solo (ver support-access-realtime.tsx).
                      <Button size="sm" className="w-full" disabled>
                        <Loader2 className="size-4 animate-spin" />
                        Ingresando…
                      </Button>
                    ) : membership.access === 'pending' ? (
                      <Button size="sm" variant="outline" className="w-full" disabled title="La organización aún no responde">
                        <Clock className="size-4" />
                        Esperando aprobación
                      </Button>
                    ) : (
                      // Botón dividido: el principal envía; la flecha elige el modo.
                      <div className="flex w-full items-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-w-0 flex-1 rounded-r-none"
                          onClick={() => submitAccessRequest(org.id)}
                          disabled={isPending}
                        >
                          {requestingOrgId === org.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : requestMode === 'control' ? (
                            <Eye className="size-4" />
                          ) : (
                            <KeyRound className="size-4" />
                          )}
                          <span className="truncate">
                            {requestMode === 'control' ? 'Solicitar acceso y tomar el control' : 'Solicitar acceso'}
                          </span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-l-none border-l-0 px-2"
                              disabled={isPending}
                              aria-label="Elegir tipo de solicitud"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-72">
                            <DropdownMenuRadioGroup
                              value={requestMode}
                              onValueChange={(value) => setRequestMode(value as AccessMode)}
                            >
                              <DropdownMenuRadioItem value="access" className="items-start">
                                <span>
                                  <span className="block font-medium">Solicitar acceso</span>
                                  <span className="block text-xs text-muted-foreground">
                                    Entras a la organización cuando un administrador lo apruebe.
                                  </span>
                                </span>
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="control" className="items-start">
                                <span>
                                  <span className="block font-medium">Solicitar acceso y tomar el control</span>
                                  <span className="block text-xs text-muted-foreground">
                                    La pantalla de la organización seguirá la tuya: páginas, cursor y clics.
                                  </span>
                                </span>
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
