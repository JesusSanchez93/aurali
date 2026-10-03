'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  readAt: string | null
  createdAt: string
  /** Para solicitudes de acceso: estado actual de la solicitud. */
  requestId: string | null
  requestStatus: string | null
}

export async function getMyNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], unread: 0 }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)

  const requestIds = (data ?? [])
    .map((n) => (n.data as { request_id?: string } | null)?.request_id)
    .filter((id): id is string => !!id)
  const { data: requests } = requestIds.length
    ? await supabase.from('organization_access_requests').select('id, status').in('id', requestIds)
    : { data: [] }
  const statusById = new Map((requests ?? []).map((r) => [r.id, r.status]))

  return {
    // Sobre las 20 más recientes: alcanza para el contador ("9+" como máximo).
    unread: (data ?? []).filter((n) => !n.read_at).length,
    items: (data ?? []).map((n) => {
      const requestId = (n.data as { request_id?: string } | null)?.request_id ?? null
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.read_at,
        createdAt: n.created_at,
        requestId,
        requestStatus: requestId ? statusById.get(requestId) ?? null : null,
      }
    }),
  }
}

/** Marca como leídas las notificaciones indicadas (solo las propias, por RLS). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)
  if (error) throw new Error(error.message)
}

/** Aprobar o rechazar una solicitud de acceso del equipo de Aurali (lo valida la base). */
export async function decideAccessRequest(requestId: string, approve: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('decide_org_access', { p_request_id: requestId, p_approve: approve })
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

/** Cortar un acceso aprobado: el superadmin sale de la organización de inmediato. */
export async function revokeAccessRequest(requestId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_org_access', { p_request_id: requestId })
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
