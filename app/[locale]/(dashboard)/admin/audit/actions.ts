'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'

export type ActorType = 'client' | 'staff' | 'system'

export type AuditLogRow = {
  id: string
  created_at: string
  action: string
  entity: string | null
  entity_id: string | null
  organization_id: string | null
  organization_name: string | null
  user_id: string | null
  user_name: string | null
  user_email: string | null
  actor_type: ActorType
  metadata: Record<string, unknown>
}

export type AuditLogFilters = {
  organizationId?: string
  action?: string
  actorType?: ActorType
  days?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

const MAX_ROWS = 300

/**
 * Cross-organization audit trail — SUPERADMIN only. Reads audit_logs across
 * ALL organizations (RLS already grants superadmins that via is_superadmin()),
 * enriched with organization/staff names for display. Used to trace what a
 * client did on the public form (or a staff/system action) when diagnosing a
 * reported problem — who did what, when, and in which organization/process.
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRow[]> {
  await requireSuperAdmin()
  const supabase = (await createClient()) as DB

  let query = supabase
    .from('audit_logs')
    .select('id, created_at, action, entity, entity_id, organization_id, user_id, metadata, organizations(name), profiles(firstname, lastname, email)')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (filters.organizationId) {
    query = query.eq('organization_id', filters.organizationId)
  }
  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.days) {
    const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows: AuditLogRow[] = (data ?? []).map((row: {
    id: string
    created_at: string
    action: string | null
    entity: string | null
    entity_id: string | null
    organization_id: string | null
    user_id: string | null
    metadata: Record<string, unknown> | null
    organizations: { name: string | null } | null
    profiles: { firstname: string | null; lastname: string | null; email: string | null } | null
  }) => {
    const metadata = row.metadata ?? {}
    const isClient = metadata.actor === 'client'
    const actor_type: ActorType = isClient ? 'client' : row.user_id ? 'staff' : 'system'
    const user_name = row.profiles
      ? [row.profiles.firstname, row.profiles.lastname].filter(Boolean).join(' ') || null
      : null

    return {
      id: row.id,
      created_at: row.created_at,
      action: row.action ?? 'default',
      entity: row.entity,
      entity_id: row.entity_id,
      organization_id: row.organization_id,
      organization_name: row.organizations?.name ?? null,
      user_id: row.user_id,
      user_name,
      user_email: row.profiles?.email ?? null,
      actor_type,
      metadata,
    }
  })

  return filters.actorType ? rows.filter((r) => r.actor_type === filters.actorType) : rows
}

export type OrganizationOption = { id: string; name: string | null }

/** Organization dropdown options for the filter bar — superadmin sees all orgs. */
export async function getAllOrganizationsForAudit(): Promise<OrganizationOption[]> {
  await requireSuperAdmin()
  const supabase = (await createClient()) as DB

  const { data } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name', { ascending: true })

  return (data ?? []) as OrganizationOption[]
}
