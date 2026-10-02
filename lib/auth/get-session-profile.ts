import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import { cache } from 'react'

export interface SessionProfile {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  system_role: 'SUPERADMIN' | 'USER'
  current_organization_id: string | null
  onboarding_status: string | null
  workflow_guide_seen: boolean
  org_role: 'ORG_ADMIN' | 'ORG_USER' | null
  org_status: 'pending' | 'active' | 'rejected' | null
  /** Nombre del rol del usuario en la organización actual. */
  org_role_name: string | null
  /** Claves de permiso efectivas en la organización actual (ver lib/auth/authorization.ts). */
  permissions: string[]
}

/**
 * Returns the current authenticated Supabase user and their profile row.
 * Used by the dashboard layout and server components that need identity info.
 */
export const getSessionProfile = cache(async (): Promise<{
  user: User | null
  profile: SessionProfile | null
}> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null }

  const { data } = await supabase
    .from('profiles')
    .select('id, email, firstname, lastname, system_role, current_organization_id, onboarding_status, workflow_guide_seen')
    .eq('id', user.id)
    .single()

  if (!data) return { user, profile: null }

  // Fetch org role + org approval status
  let org_role: 'ORG_ADMIN' | 'ORG_USER' | null = null
  let org_status: 'pending' | 'active' | 'rejected' | null = null
  let org_role_name: string | null = null
  let permissions: string[] = []
  if (data.current_organization_id) {
    const [{ data: membership }, { data: org }, { data: permissionKeys }] = await Promise.all([
      supabase
        .from('organization_members')
        .select('role, roles(name)')
        .eq('organization_id', data.current_organization_id)
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('status')
        .eq('id', data.current_organization_id)
        .maybeSingle(),
      supabase.rpc('my_permissions', { p_org_id: data.current_organization_id }),
    ])
    org_role = (membership?.role as 'ORG_ADMIN' | 'ORG_USER') ?? null
    org_role_name = membership?.roles?.name ?? null
    org_status = (org?.status as 'pending' | 'active' | 'rejected') ?? null
    permissions = permissionKeys ?? []
  }

  return { user, profile: { ...(data as SessionProfile), org_role, org_status, org_role_name, permissions } }
})
