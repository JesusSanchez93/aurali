'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import { useProfile } from '@/components/providers/profile-provider'
import {
  CLICKABLE,
  anchorFor,
  anchoredPoint,
  controlLabel,
  stripLocale,
  supportControlTopic,
  type AnchoredPoint,
  type Anchor,
  type SupportControlMessage,
} from '@/lib/support/cobrowse'

// Cursor y scroll viajan juntos cada FLUSH_MS: queda bajo el límite de
// mensajes por segundo del cliente de Realtime.
const FLUSH_MS = 150

function pageLabel(): string {
  return document.title.replace(/\s*\|\s*Aurali\s*$/, '').trim() || 'Página'
}

const currentPath = () => stripLocale(window.location.pathname) + window.location.search

/**
 * Modo "tomar el control" (lado del superadmin). La pantalla de la
 * organización sigue a la suya: emite por Broadcast la página, el cursor, los
 * clics y el scroll (ver support-control-viewer.tsx). Además deja la
 * auditoría en support_session_events. Solo corre con un acceso de control
 * vigente; RLS vuelve a exigirlo para el canal y para los eventos. No
 * renderiza nada.
 */
export function SupportSessionTracker() {
  const profile = useProfile()
  const pathname = usePathname()
  const access = profile.support_access
  const orgId = profile.current_organization_id
  const active = profile.system_role === 'SUPERADMIN' && !!orgId && access?.mode === 'control'
  const requestId = active ? access.requestId : null
  const lastRef = useRef<{ key: string; at: number } | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const send = (message: SupportControlMessage) => {
    void channelRef.current?.send({ type: 'broadcast', event: message.event, payload: message.payload })
  }

  const record = (kind: 'navigation' | 'action', label: string, path: string | null) => {
    if (!active || !access || !orgId || !label) return
    const key = `${kind}:${label}:${path ?? ''}`
    const now = Date.now()
    if (lastRef.current && lastRef.current.key === key && now - lastRef.current.at < 1000) return
    lastRef.current = { key, at: now }
    void createClient()
      .from('support_session_events')
      .insert({ organization_id: orgId, request_id: access.requestId, actor_id: profile.id, kind, label, path })
      .then(({ error }) => {
        if (error) console.warn('[SupportSessionTracker]', error.message)
      })
  }

  // Canal: al conectarse (o cuando la organización pide sincronizar) se
  // reenvía la página actual.
  useEffect(() => {
    if (!requestId) return
    const cleanup = subscribeAuthenticated(
      createClient(),
      (supabase) =>
        supabase
          .channel(supportControlTopic(requestId), { config: { private: true, broadcast: { self: false } } })
          .on('broadcast', { event: 'sync' }, () => send({ event: 'nav', payload: { path: currentPath() } })),
      (status, channel) => {
        channelRef.current = status === 'SUBSCRIBED' ? channel : null
        if (status === 'SUBSCRIBED') send({ event: 'nav', payload: { path: currentPath() } })
      },
    )
    const onUnload = () => send({ event: 'leave', payload: {} })
    window.addEventListener('beforeunload', onUnload)
    return () => {
      onUnload()
      window.removeEventListener('beforeunload', onUnload)
      channelRef.current = null
      cleanup()
    }
  }, [requestId])

  // Páginas: el título se actualiza un instante después de navegar.
  useEffect(() => {
    if (!active) return
    send({ event: 'nav', payload: { path: currentPath() } })
    const timer = setTimeout(() => record('navigation', pageLabel(), stripLocale(pathname)), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pathname])

  // Cursor, clics y scroll.
  useEffect(() => {
    if (!active) return
    let pointer: AnchoredPoint | undefined
    let scroll: { anchor: Anchor; ratio: number } | undefined

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return
      pointer = anchoredPoint(event.target, event.clientX, event.clientY)
    }
    const onScroll = (event: Event) => {
      const el = event.target instanceof Element ? event.target : document.scrollingElement
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      scroll = { anchor: anchorFor(el), ratio: max > 0 ? el.scrollTop / max : 0 }
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const target = event.target.closest(CLICKABLE)
      const label = target ? controlLabel(target) : ''
      send({ event: 'click', payload: { ...anchoredPoint(target ?? event.target, event.clientX, event.clientY), label } })
      if (target) record('action', label, null)
    }
    const flush = setInterval(() => {
      if (!pointer && !scroll) return
      send({ event: 'state', payload: { pointer, scroll } })
      pointer = undefined
      scroll = undefined
    }, FLUSH_MS)

    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    document.addEventListener('click', onClick, true)
    return () => {
      clearInterval(flush)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('click', onClick, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}
