'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { getAuditLogs, type AuditLogRow, type ActorType, type OrganizationOption } from '../actions'
import { User, Bot, Server, ChevronDown, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  initialLogs: AuditLogRow[]
  organizations: OrganizationOption[]
}

const ACTION_LABELS: Record<string, string> = {
  process_created: 'Proceso creado',
  workflow_started: 'Flujo iniciado',
  workflow_resumed: 'Flujo reanudado',
  workflow_completed: 'Flujo completado',
  workflow_failed: 'Error en el flujo',
  workflow_retried: 'Flujo reintentado',
  status_change: 'Cambio de estado',
  email_sent: 'Email enviado',
  document_generated: 'Documentos generados',
  document_preview_generated: 'Borradores generados',
  document_preview_updated: 'Borrador actualizado',
  payment_confirmed: 'Pago confirmado',
  payment_registered: 'Pago registrado',
  workflow_notification: 'Notificación enviada',
  email_resent: 'Email reenviado',
  documents_approved: 'Documentos aprobados',
  client_form_link_opened: 'Cliente abrió el enlace del formulario',
  client_form_link_invalid: 'Intento de acceso con enlace inválido',
  client_personal_data_submitted: 'Cliente envió sus datos personales',
  client_document_validation_failed: 'Validación de documento falló',
  client_banking_info_submitted: 'Cliente envió información bancaria',
  client_image_deleted: 'Cliente eliminó una imagen subida',
  client_process_completed: 'Cliente completó el formulario',
}

// Actions worth flagging visually — the ones a superadmin is usually hunting for
// when diagnosing a reported problem.
const WARNING_ACTIONS = new Set([
  'client_document_validation_failed',
  'client_form_link_invalid',
  'workflow_failed',
])

const ACTOR_META: Record<ActorType, { label: string; icon: typeof User; className: string }> = {
  client: { label: 'Cliente', icon: User, className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  staff: { label: 'Personal', icon: User, className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300' },
  system: { label: 'Sistema', icon: Server, className: 'bg-muted text-muted-foreground' },
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

const METADATA_SUMMARY_OMIT = new Set(['actor', 'ip', 'user_agent'])

function metadataSummary(metadata: Record<string, unknown>): string | null {
  const entries = Object.entries(metadata).filter(
    ([k, v]) => !METADATA_SUMMARY_OMIT.has(k) && v !== null && v !== undefined && v !== '',
  )
  if (entries.length === 0) return null
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join(' · ')
}

export function AuditLogTable({ initialLogs, organizations }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [organizationId, setOrganizationId] = useState<string>('all')
  const [actorType, setActorType] = useState<string>('all')
  const [days, setDays] = useState<string>('30')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const availableActions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs],
  )

  function refetch(next: { organizationId?: string; actorType?: string; days?: string }) {
    const nextOrg = next.organizationId ?? organizationId
    const nextActor = next.actorType ?? actorType
    const nextDays = next.days ?? days

    startTransition(async () => {
      const data = await getAuditLogs({
        organizationId: nextOrg === 'all' ? undefined : nextOrg,
        actorType: nextActor === 'all' ? undefined : (nextActor as ActorType),
        days: nextDays === 'all' ? undefined : Number(nextDays),
      })
      setLogs(data)
    })
  }

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((log) => {
      const haystack = [
        log.entity_id,
        log.user_name,
        log.user_email,
        log.organization_name,
        actionLabel(log.action),
        JSON.stringify(log.metadata),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logs, search])

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <Select value={organizationId} onValueChange={(v) => { setOrganizationId(v); refetch({ organizationId: v }) }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Organización" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las organizaciones</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>{org.name ?? 'Sin nombre'}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actorType} onValueChange={(v) => { setActorType(v); refetch({ actorType: v }) }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los actores</SelectItem>
            <SelectItem value="client">Clientes</SelectItem>
            <SelectItem value="staff">Personal</SelectItem>
            <SelectItem value="system">Sistema</SelectItem>
          </SelectContent>
        </Select>

        <Select value={days} onValueChange={(v) => { setDays(v); refetch({ days: v }) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24h</SelectItem>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
            <SelectItem value="90">Últimos 90 días</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por proceso, email, organización…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Action legend / count */}
      <p className="text-xs text-muted-foreground">
        {filteredLogs.length} de {logs.length} eventos
        {availableActions.length > 0 && ' · '}
        {availableActions.length > 0 && `${availableActions.length} tipos de acción en el periodo`}
      </p>

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Bot className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay eventos que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border bg-card">
          {filteredLogs.map((log) => {
            const actor = ACTOR_META[log.actor_type]
            const ActorIcon = actor.icon
            const summary = metadataSummary(log.metadata)
            const isWarning = WARNING_ACTIONS.has(log.action)
            const isExpanded = expandedId === log.id

            return (
              <Collapsible key={log.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? log.id : null)}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50">
                    <Badge variant="secondary" className={cn('mt-0.5 gap-1.5 shrink-0', actor.className)}>
                      <ActorIcon className="size-3" />
                      {actor.label}
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('text-sm font-medium', isWarning && 'text-destructive')}>
                          {actionLabel(log.action)}
                        </p>
                        {log.organization_name && (
                          <Badge variant="outline" className="text-[10px] font-normal">{log.organization_name}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span suppressHydrationWarning>
                          {new Date(log.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {log.user_name && <span>· {log.user_name}</span>}
                        {!log.user_name && log.user_email && <span>· {log.user_email}</span>}
                        {log.entity_id && (
                          <span className="font-mono">· proceso {log.entity_id.slice(0, 8)}…</span>
                        )}
                      </div>
                      {summary && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{summary}</p>
                      )}
                    </div>

                    <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t bg-muted/30 px-6 py-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Detalles del evento</p>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                      {JSON.stringify({ entity: log.entity, entity_id: log.entity_id, ...log.metadata }, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      )}
    </div>
  )
}
