import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

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
}

/**
 * Returns the current authenticated Supabase user and their profile row.
 * Used by the dashboard layout and server components that need identity info.
 */
export async function getSessionProfile(): Promise<{
  user: User | null
  profile: SessionProfile | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, profile: null }

  const { data } = await supabase
    .from('profiles')
    .select('id, email, firstname, lastname, system_role, current_organization_id, onboarding_status, workflow_guide_seen')
    .eq('id', user.id)
    .single()

  if (!data) return { user, profile: null }

  // Fetch org role
  let org_role: 'ORG_ADMIN' | 'ORG_USER' | null = null
  if (data.current_organization_id) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', data.current_organization_id)
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
    org_role = (membership?.role as 'ORG_ADMIN' | 'ORG_USER') ?? null
  }

  return { user, profile: { ...(data as SessionProfile), org_role } }
}
