'use client'

import { useState, useTransition } from 'react'
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
  enterOrganizationAction,
} from '../actions'
import { Building2, LogIn, Loader2 } from 'lucide-react'

interface Props {
  clients: ClientRow[]
}

export function ClientsList({ clients }: Props) {
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [orgs, setOrgs] = useState<ClientOrgRow[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [enteringOrgId, setEnteringOrgId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const openOrgs = async (client: ClientRow) => {
    setSelectedClient(client)
    setLoadingOrgs(true)
    const data = await getClientOrganizations(client.id)
    setOrgs(data)
    setLoadingOrgs(false)
  }

  const enterOrg = (orgId: string) => {
    setEnteringOrgId(orgId)
    startTransition(async () => {
      await enterOrganizationAction(orgId)
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
              variant="outline"
              size="sm"
              onClick={() => openOrgs(client)}
            >
              Ver organizaciones
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
                const isEntering = enteringOrgId === org.id && isPending

                return (
                  <div key={org.id} className="flex items-center gap-3 px-4 py-3">
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {org.name ?? org.legal_name ?? 'Sin nombre'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {membership.role.toLowerCase().replace('_', ' ')}
                      </p>
                    </div>
                    <Badge
                      variant={org.status === 'active' ? 'default' : 'secondary'}
                      className="shrink-0"
                    >
                      {org.status ?? 'draft'}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => enterOrg(org.id)}
                      disabled={isPending}
                    >
                      {isEntering ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogIn className="size-4" />
                      )}
                      Entrar
                    </Button>
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
