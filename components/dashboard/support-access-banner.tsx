import { ShieldCheck, ShieldQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { SessionProfile } from '@/lib/auth/get-session-profile'
import { AccessRequestButtons } from './access-request-buttons'
import { SupportActivityPanel, type SupportActivityEvent } from './support-activity-panel'

interface Props {
  profile: SessionProfile
}

/**
 * Aviso para los miembros de la organización mientras el equipo de Aurali
 * tiene acceso aprobado o pide acceso. Así la organización sabe en todo
 * momento cuándo alguien de Aurali está en su cuenta.
 */
export async function SupportAccessBanner({ profile }: Props) {
  if (!profile.current_organization_id || profile.system_role === 'SUPERADMIN') return null

  const supabase = await createClient()
  const { data: requests } = await supabase
    .from('organization_access_requests')
    .select('id, status, mode, requested_by, decided_at, created_at')
    .eq('organization_id', profile.current_organization_id)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true })

  if (!requests?.length) return null

  const canManage = profile.permissions.includes('settings.manage')
  const names = await Promise.all(
    requests.map(async (r) => {
      const { data } = await supabase.rpc('staff_display_name', { p_user_id: r.requested_by })
      return data ?? 'Equipo de Aurali'
    }),
  )

  // En modo control, la organización ve en vivo la actividad del superadmin.
  const controlIndex = requests.findIndex((r) => r.status === 'approved' && r.mode === 'control')
  const control = controlIndex >= 0 ? requests[controlIndex] : null
  const { data: initialEvents } = control
    ? await supabase
        .from('support_session_events')
        .select('id, kind, label, path, created_at')
        .eq('request_id', control.id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: null }

  return (
    <>
      {control && (
        <SupportActivityPanel
          key={control.id}
          requestId={control.id}
          staffName={names[controlIndex]}
          initialEvents={(initialEvents ?? []) as SupportActivityEvent[]}
        />
      )}
      {requests.map((r, i) => {
        const approved = r.status === 'approved'
        const Icon = approved ? ShieldCheck : ShieldQuestion
        return (
          <div
            key={r.id}
            className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-amber-400 px-4 py-2 shadow-sm md:px-6"
          >
            <div className="flex min-w-0 items-start gap-2 text-sm text-amber-950">
              <Icon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <strong className="font-semibold">{names[i]}</strong>
                {approved
                  ? r.mode === 'control'
                    ? ', del equipo de Aurali, tiene el control de tu cuenta. Ves su actividad en vivo.'
                    : ', del equipo de Aurali, tiene acceso a tu cuenta.'
                  : r.mode === 'control'
                    ? ', del equipo de Aurali, solicita acceso y tomar el control de tu cuenta. Verás en vivo todo lo que haga.'
                    : ', del equipo de Aurali, solicita acceso a tu cuenta.'}
                {!approved && !canManage && (
                  <span className="text-amber-900"> · Un administrador debe aprobarla.</span>
                )}
              </span>
            </div>
            {canManage &&
              (approved ? (
                <AccessRequestButtons requestId={r.id} mode="revoke" tone="banner" />
              ) : (
                <AccessRequestButtons requestId={r.id} mode="decide" tone="banner" />
              ))}
          </div>
        )
      })}
    </>
  )
}
