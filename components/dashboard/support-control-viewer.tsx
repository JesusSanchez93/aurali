'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { MonitorPlay, MonitorX } from 'lucide-react'
import { useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import {
  CLICKABLE,
  controlLabel,
  resolveAnchor,
  resolvePoint,
  stripLocale,
  supportControlTopic,
  type SupportControlMessage,
} from '@/lib/support/cobrowse'

interface Props {
  requestId: string
  staffName: string
}

interface Ripple {
  id: number
  x: number
  y: number
  rect: { top: number; left: number; width: number; height: number } | null
}

type Payload<E extends SupportControlMessage['event']> = Extract<SupportControlMessage, { event: E }>['payload']

// Tras un clic del superadmin los datos pueden cambiar (guardó, creó, borró):
// se refresca la página de la organización cuando él deja de pulsar.
const REFRESH_AFTER_CLICK_MS = 1200

/**
 * Modo "tomar el control" (lado de la organización): la pantalla sigue a la
 * del superadmin — cambia de página con él, muestra su cursor, marca cada
 * clic y sincroniza el scroll. Mientras sigue, la pantalla es solo de lectura;
 * "Dejar de seguir" la devuelve. Ver support-session-tracker.tsx.
 */
export function SupportControlViewer({ requestId, staffName }: Props) {
  const router = useRouter()
  const routerRef = useRef(router)
  const [following, setFollowing] = useState(true)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const followingRef = useRef(following)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    followingRef.current = following
    // Al volver a seguir, se pide la página actual del superadmin.
    if (following) void channelRef.current?.send({ type: 'broadcast', event: 'sync', payload: {} })
  }, [following])

  useEffect(() => {
    const onNav = ({ path }: Payload<'nav'>) => {
      if (!followingRef.current) return
      if (stripLocale(window.location.pathname) + window.location.search !== path) routerRef.current.push(path)
    }
    const onState = ({ pointer, scroll }: Payload<'state'>) => {
      if (!followingRef.current) return
      if (pointer) setCursor(resolvePoint(pointer))
      if (scroll) {
        const el = resolveAnchor(scroll.anchor) ?? (scroll.anchor.root === 'body' ? document.scrollingElement : null)
        if (el) el.scrollTop = scroll.ratio * (el.scrollHeight - el.clientHeight)
      }
    }
    const onClick = (click: Payload<'click'>) => {
      if (!followingRef.current) return
      let el = resolveAnchor(click.anchor)
      // Si la estructura difiere (p. ej. otro menú por permisos), se busca el control por su nombre.
      if (!el && click.label) {
        el = Array.from(document.querySelectorAll(CLICKABLE)).find((c) => controlLabel(c) === click.label) ?? null
      }
      const { x, y } = resolvePoint(click, el)
      const box = el?.getBoundingClientRect()
      const ripple: Ripple = {
        id: Date.now() + Math.random(),
        x,
        y,
        rect: box && box.width < window.innerWidth * 0.9 ? { top: box.top, left: box.left, width: box.width, height: box.height } : null,
      }
      setCursor({ x, y })
      setRipples((prev) => [...prev, ripple])
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id)), 900)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => routerRef.current.refresh(), REFRESH_AFTER_CLICK_MS)
    }

    const cleanup = subscribeAuthenticated(
      createClient(),
      (supabase) =>
        supabase
          .channel(supportControlTopic(requestId), { config: { private: true, broadcast: { self: false } } })
          .on('broadcast', { event: 'nav' }, ({ payload }) => onNav(payload))
          .on('broadcast', { event: 'state' }, ({ payload }) => onState(payload))
          .on('broadcast', { event: 'click' }, ({ payload }) => onClick(payload))
          .on('broadcast', { event: 'leave' }, () => setCursor(null)),
      (status, channel) => {
        channelRef.current = status === 'SUBSCRIBED' ? channel : null
        if (status === 'SUBSCRIBED') void channel.send({ type: 'broadcast', event: 'sync', payload: {} })
      },
    )
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      channelRef.current = null
      cleanup()
    }
  }, [requestId])

  // Solo lectura mientras sigue: el teclado tampoco llega a la página.
  useEffect(() => {
    if (!following) return
    const blockKeys = (event: KeyboardEvent) => {
      if ((event.target as Element | null)?.closest('[data-support-control]')) return
      event.preventDefault()
      event.stopPropagation()
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.addEventListener('keydown', blockKeys, true)
    return () => window.removeEventListener('keydown', blockKeys, true)
  }, [following])

  return (
    <>
      {following && <div aria-hidden className="fixed inset-0 z-[60] cursor-not-allowed" />}

      {following &&
        ripples.map((r) => (
          <div key={r.id} className="pointer-events-none fixed inset-0 z-[61]">
            {r.rect && (
              <div
                className="absolute rounded-md ring-2 ring-amber-400 ring-offset-2 animate-out fade-out-0 duration-700 fill-mode-forwards"
                style={{ top: r.rect.top, left: r.rect.left, width: r.rect.width, height: r.rect.height }}
              />
            )}
            <span
              className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/60 animate-ping"
              style={{ left: r.x, top: r.y }}
            />
          </div>
        ))}

      {following && cursor && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[62] transition-transform duration-150 ease-linear"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow">
            <path d="M2 2 L2 16 L6 12 L9 18 L11.5 17 L8.5 11 L14 11 Z" className="fill-amber-400 stroke-amber-950" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span className="ml-4 inline-block whitespace-nowrap rounded-md bg-amber-400 px-2 py-0.5 text-xs font-medium text-amber-950 shadow">
            {staffName}
          </span>
        </div>
      )}

      <div
        data-support-control
        className="fixed bottom-4 left-1/2 z-[63] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-amber-400 py-1.5 pl-4 pr-1.5 text-sm text-amber-950 shadow-lg"
      >
        <span className="relative flex size-2 shrink-0">
          {following && <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-950/60" />}
          <span className="relative inline-flex size-2 rounded-full bg-amber-950" />
        </span>
        <span className="truncate">
          {following ? (
            <>
              <strong className="font-semibold">{staffName}</strong> está controlando tu pantalla
            </>
          ) : (
            <>
              <strong className="font-semibold">{staffName}</strong> tiene el control de tu cuenta
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setFollowing((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-950 px-3 py-1 text-xs font-medium text-amber-50 transition-colors hover:bg-amber-900"
        >
          {following ? <MonitorX className="size-3.5" /> : <MonitorPlay className="size-3.5" />}
          {following ? 'Dejar de seguir' : 'Volver a seguir'}
        </button>
      </div>
    </>
  )
}
