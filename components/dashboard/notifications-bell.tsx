'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import { useProfile } from '@/components/providers/profile-provider'
import { getMyNotifications, markNotificationsRead, type NotificationItem } from './notifications-actions'
import { AccessRequestButtons } from './access-request-buttons'

/** Una solicitud de acceso pendiente sigue siendo accionable: no se marca leída al abrir. */
const isActionable = (n: NotificationItem) => n.type === 'support_access_request' && n.requestStatus === 'pending'

export function NotificationsBell() {
  const profile = useProfile()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getMyNotifications()
      setItems(result.items)
      setUnread(result.unread)
      return result.items
    } catch {
      return []
    }
  }, [])

  // Carga inicial y luego en vivo: cualquier notificación nueva o marcada
  // como leída (también cuando otro administrador responde una solicitud)
  // recarga la lista. Realtime respeta RLS: solo llegan las propias.
  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    // Nombre único por montaje: `channel()` reutiliza un canal con el mismo
    // nombre, y al remontar (StrictMode en desarrollo) se quedaba con el que
    // la limpieza estaba cerrando, sin recibir eventos.
    const unsubscribe = subscribeAuthenticated(createClient(), (supabase) =>
      supabase
        .channel(`notifications:${profile.id}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
          () => void load(),
        ),
    )
    return () => {
      clearTimeout(first)
      unsubscribe()
    }
  }, [load, profile.id])

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    const latest = await load()
    const toMark = latest.filter((n) => !n.readAt && !isActionable(n)).map((n) => n.id)
    if (toMark.length > 0) {
      await markNotificationsRead(toMark)
      setUnread((u) => Math.max(0, u - toMark.length))
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones" title="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] border-white/40 bg-white/70 p-0 backdrop-blur-xl dark:border-white/10 dark:bg-background/70">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
        ) : (
          <ul className="max-h-[24rem] divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn('space-y-2 px-4 py-3', !n.readAt && 'bg-muted/40')}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                  </span>
                </div>
                {n.body && <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p>}
                {isActionable(n) && n.requestId && (
                  <AccessRequestButtons requestId={n.requestId} mode="decide" onDone={() => void load()} />
                )}
                {n.type === 'support_access_request' && n.requestStatus && n.requestStatus !== 'pending' && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {n.requestStatus === 'approved' && 'Aprobada'}
                    {n.requestStatus === 'rejected' && 'Rechazada'}
                    {n.requestStatus === 'revoked' && 'Acceso revocado'}
                    {n.requestStatus === 'ended' && 'Acceso finalizado'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
