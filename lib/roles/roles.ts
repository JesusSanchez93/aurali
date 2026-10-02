import { createClient } from '@/lib/supabase/server'

export interface PermissionDef {
  id: string
  key: string
  resource: string
  action: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
}

export interface RoleSummary {
  id: string
  organizationId: string | null
  /** Rol oficial de Aurali (no pertenece a ninguna organización). */
  isSystem: boolean
  code: string | null
  name: string
  description: string | null
  isActive: boolean
  sourceRoleId: string | null
  sourceRoleName: string | null
  permissionKeys: string[]
  memberCount: number
  /** El rol oficial del que partió cambió sus permisos después de la copia. */
  updateAvailable: boolean
}

export interface RoleInput {
  id?: string | null
  name: string
  description?: string | null
  sourceRoleId?: string | null
  permissionKeys: string[]
}

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function fetchPermissionCatalog(supabase: Supabase, { onlyActive = true } = {}): Promise<PermissionDef[]> {
  let query = supabase
    .from('permissions')
    .select('id, key, resource, action, name, description, is_active, sort_order')
    .order('sort_order', { ascending: true })
  if (onlyActive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((p) => ({
    id: p.id,
    key: p.key,
    resource: p.resource,
    action: p.action,
    name: p.name,
    description: p.description,
    isActive: p.is_active,
    sortOrder: p.sort_order,
  }))
}

/**
 * Roles oficiales de Aurali y, si se indica, los personalizados de una
 * organización. `memberCount` se limita a esa organización; sin organización
 * (panel de superadmin) cuenta los miembros de todas.
 */
export async function fetchRoles(supabase: Supabase, organizationId: string | null): Promise<RoleSummary[]> {
  let rolesQuery = supabase
    .from('roles')
    .select('id, organization_id, code, name, description, is_active, source_role_id, source_synced_at, permissions_updated_at, created_at, role_permissions(permissions(key, is_active))')
    .order('created_at', { ascending: true })
  rolesQuery = organizationId
    ? rolesQuery.or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    : rolesQuery.is('organization_id', null)

  let membersQuery = supabase.from('organization_members').select('role_id')
  if (organizationId) membersQuery = membersQuery.eq('organization_id', organizationId)

  const [{ data: roles, error }, { data: members, error: membersError }] = await Promise.all([rolesQuery, membersQuery])
  if (error) throw new Error(error.message)
  if (membersError) throw new Error(membersError.message)

  const memberCountByRole = new Map<string, number>()
  for (const m of members ?? []) {
    memberCountByRole.set(m.role_id, (memberCountByRole.get(m.role_id) ?? 0) + 1)
  }

  const byId = new Map((roles ?? []).map((r) => [r.id, r]))

  // Los roles base comparten `created_at`: se ordenan de mayor a menor alcance.
  const baseOrder = (code: string | null) => {
    const index = ['admin', 'lawyer', 'assistant'].indexOf(code ?? '')
    return index === -1 ? 99 : index
  }
  const sorted = [...(roles ?? [])].sort((a, b) => baseOrder(a.code) - baseOrder(b.code))

  return sorted.map((r) => {
    const source = r.source_role_id ? byId.get(r.source_role_id) : undefined
    const updateAvailable = Boolean(
      source
      && r.organization_id !== null
      && source.organization_id === null
      && r.source_synced_at
      && new Date(source.permissions_updated_at) > new Date(r.source_synced_at),
    )

    return {
      id: r.id,
      organizationId: r.organization_id,
      isSystem: r.organization_id === null,
      code: r.code,
      name: r.name,
      description: r.description,
      isActive: r.is_active,
      sourceRoleId: r.source_role_id,
      sourceRoleName: source?.name ?? null,
      permissionKeys: r.role_permissions
        .filter((rp) => rp.permissions?.is_active)
        .map((rp) => rp.permissions.key),
      memberCount: memberCountByRole.get(r.id) ?? 0,
      updateAvailable,
    }
  })
}

/** Traduce errores de Postgres/RLS a mensajes que se pueden mostrar al usuario. */
export function roleErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ya existe un rol con ese nombre'
  if (error.code === '23503') return 'Este rol está asignado a miembros o invitaciones; reasígnalos antes de eliminarlo'
  if (error.message.includes('row-level security')) return 'No tienes permiso para realizar este cambio'
  return error.message
}
