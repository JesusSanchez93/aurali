import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type SystemRole = 'SUPERADMIN' | 'USER'
export type OrgRole = 'ORG_ADMIN' | 'ORG_USER'

export interface SessionProfile {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  system_role: SystemRole
  current_organization_id: string | null
  onboarding_status: string | null
}

/**
 * Returns the current authenticated user's profile, or null if unauthenticated.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, firstname, lastname, system_role, current_organization_id, onboarding_status')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return data as SessionProfile
}

/**
 * Requires authentication. Redirects to login if unauthenticated.
 */
export async function requireAuth(): Promise<SessionProfile> {
  const profile = await getSessionProfile()
  if (!profile) redirect('/auth/login')
  return profile
}

/**
 * Requires SUPERADMIN system role. Throws if the user lacks it.
 */
export async function requireSuperAdmin(): Promise<SessionProfile> {
  const profile = await requireAuth()
  if (profile.system_role !== 'SUPERADMIN') {
    throw new Error('Forbidden: SUPERADMIN access required')
  }
  return profile
}

/**
 * Requires the user to be an active member of the given organization.
 * SUPERADMIN bypasses this check.
 */
export async function requireOrgAccess(orgId: string): Promise<SessionProfile> {
  const supabase = await createClient()
  const profile = await requireAuth()

  if (profile.system_role === 'SUPERADMIN') return profile

  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .eq('active', true)
    .single()

  if (!data) throw new Error('Forbidden: Not a member of this organization')
  return profile
}

/**
 * Requires the user to be an ORG_ADMIN of the given organization.
 * SUPERADMIN bypasses this check.
 */
export async function requireOrgAdmin(orgId: string): Promise<SessionProfile> {
  const supabase = await createClient()
  const profile = await requireAuth()

  if (profile.system_role === 'SUPERADMIN') return profile

  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .eq('role', 'ORG_ADMIN')
    .eq('active', true)
    .single()

  if (!data) throw new Error('Forbidden: ORG_ADMIN access required')
  return profile
}

/** Returns true when the profile has the SUPERADMIN system role. */
export function isSuperAdmin(profile: SessionProfile): boolean {
  return profile.system_role === 'SUPERADMIN'
}
