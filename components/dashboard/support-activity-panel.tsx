'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Compass, MousePointerClick, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import { cn } from '@/lib/utils'

export interface SupportActivityEvent {
  id: string
  kind: 'navigation' | 'action'
  label: string
  path: string | null
  created_at: string
}

interface Props {
  requestId: string
  staffName: string
  initialEvents: SupportActivityEvent[]
}

const MAX_EVENTS = 50

const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Panel flotante para la organización: lo que hace en vivo el superadmin que
 * entró en modo "tomar el control".
 */
export function SupportActivityPanel({ requestId, staffName, initialEvents }: Props) {
  const [events, setEvents] = useState<SupportActivityEvent[]>(initialEvents)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    return subscribeAuthenticated(createClient(), (supabase) =>
      supabase
        .channel(`support_session_events:${requestId}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_session_events', filter: `request_id=eq.${requestId}` },
          (payload) => {
            const row = payload.new as SupportActivityEvent
            setEvents((prev) => [row, ...prev.filter((e) => e.id !== row.id)].slice(0, MAX_EVENTS))
          },
        ),
    )
  }, [requestId])

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-background shadow-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-amber-400 px-4 py-2.5 text-left text-amber-950"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Radio className="size-4 shrink-0 animate-pulse" />
          <span className="truncate">Actividad de {staffName} en vivo</span>
        </span>
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronUp className="size-4 shrink-0" />}
      </button>
      {open && (
        <ul className="max-h-72 divide-y overflow-y-auto">
          {events.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay actividad.</li>
          ) : (
            events.map((event, index) => {
              const Icon = event.kind === 'navigation' ? Compass : MousePointerClick
              return (
                <li key={event.id} className={cn('flex items-start gap-3 px-4 py-2.5', index === 0 && 'bg-muted/40')}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {event.kind === 'navigation' ? 'Abrió ' : 'Pulsó '}
                      <span className="font-medium">{event.label}</span>
                    </p>
                    {event.path && <p className="truncate text-xs text-muted-foreground">{event.path}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {timeFormat.format(new Date(event.created_at))}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
