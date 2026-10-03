'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/components/providers/profile-provider'

const CLICKABLE = 'button, a[href], [role="menuitem"], [role="menuitemradio"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"]'

/** Nombre visible de un control: lo que lee el usuario, nunca lo escrito en campos. */
function controlLabel(el: Element): string {
  const fromAttr = el.getAttribute('aria-label') || el.getAttribute('title')
  const text = (fromAttr || (el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 120)
}

function pageLabel(): string {
  return document.title.replace(/\s*\|\s*Aurali\s*$/, '').trim() || 'Página'
}

/**
 * Modo "tomar el control": registra cada página que abre el superadmin y cada
 * control que pulsa, para que la organización lo vea en vivo
 * (support_session_events). Solo corre con un acceso de control vigente y RLS
 * vuelve a exigirlo al insertar. No renderiza nada.
 */
export function SupportSessionTracker() {
  const profile = useProfile()
  const pathname = usePathname()
  const access = profile.support_access
  const orgId = profile.current_organization_id
  const active = profile.system_role === 'SUPERADMIN' && !!orgId && access?.mode === 'control'
  const lastRef = useRef<{ key: string; at: number } | null>(null)

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

  // Páginas: el título se actualiza un instante después de navegar.
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => record('navigation', pageLabel(), pathname.replace(/^\/(es|en)(?=\/|$)/, '') || '/'), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pathname])

  // Acciones: botones, enlaces, opciones de menú y pestañas que pulsa.
  useEffect(() => {
    if (!active) return
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest(CLICKABLE)
      if (!target) return
      record('action', controlLabel(target), null)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}
