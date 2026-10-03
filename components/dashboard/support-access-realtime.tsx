'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { subscribeAuthenticated } from '@/lib/supabase/realtime'
import { useProfile } from '@/components/providers/profile-provider'
import { toast } from '@/lib/toast'
import { enterOrganizationAction, getApprovedAccessToEnter } from '@/app/[locale]/(dashboard)/admin/clients/actions'

/**
 * Mantiene en vivo el flujo de acceso del equipo de Aurali:
 * - Miembros de la organización: el aviso de solicitud/acceso aparece,
 *   cambia y desaparece sin recargar.
 * - Superadmin: cuando la organización aprueba su solicitud, entra
 *   automáticamente (también si la aprobación llegó mientras no tenía la app
 *   abierta); si revoca su acceso mientras está dentro, sale de inmediato.
 * No renderiza nada.
 */
export function SupportAccessRealtime() {
  const profile = useProfile()
  const router = useRouter()
  const isSuperAdmin = profile.system_role === 'SUPERADMIN'
  const orgId = profile.current_organization_id
  const enteringRef = useRef(false)

  // Si ya está dentro de otra organización no lo cambia de golpe: entrará
  // cuando salga (el chequeo de abajo corre al volver al panel de plataforma).
  const enterApproved = (organizationId: string, organizationName?: string | null) => {
    if (enteringRef.current) return
    if (orgId) {
      toast.success(`${organizationName ?? 'Una organización'} aprobó tu acceso. Sal de la organización actual para ingresar.`)
      return
    }
    enteringRef.current = true
    toast.success(`Acceso aprobado. Ingresando a ${organizationName ?? 'la organización'}…`)
    enterOrganizationAction(organizationId).catch((err: unknown) => {
      // redirect() se propaga como excepción: es la navegación, no un error.
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return
      enteringRef.current = false
      toast.error(err instanceof Error ? err.message : 'No se pudo ingresar a la organización')
    })
  }

  useEffect(() => {
    if (!isSuperAdmin || orgId) return
    let cancelled = false
    void getApprovedAccessToEnter().then((pending) => {
      if (!cancelled && pending) enterApproved(pending.organizationId, pending.organizationName)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, orgId])

  useEffect(() => {
    if (!isSuperAdmin && !orgId) return

    const filter = isSuperAdmin ? `requested_by=eq.${profile.id}` : `organization_id=eq.${orgId}`
    // Nombre único por montaje: `channel()` reutiliza un canal con el mismo
    // nombre, y al remontar (StrictMode en desarrollo) se quedaba con el que
    // la limpieza estaba cerrando, sin recibir eventos.
    return subscribeAuthenticated(createClient(), (supabase) =>
      supabase
        .channel(`access_requests:${filter}:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_access_requests', filter }, (payload) => {
          const row = payload.new as { status?: string; organization_id?: string }
          const previous = payload.old as { status?: string }
          if (isSuperAdmin && row.status === 'revoked' && orgId && row.organization_id === orgId) {
            toast.error('La organización revocó tu acceso')
            router.push('/admin/clients')
          }
          if (isSuperAdmin && row.status === 'approved' && previous?.status !== 'approved' && row.organization_id) {
            enterApproved(row.organization_id)
            return
          }
          router.refresh()
        }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, orgId, profile.id, router])

  return null
}
