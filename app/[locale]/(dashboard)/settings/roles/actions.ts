'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ForbiddenError, requireAnyPermission, requirePermission } from '@/lib/auth/authorization'
import { PERMISSION_KEYS } from '@/lib/auth/permission-keys'
import { getOrgPlan } from '@/lib/billing/getOrgPlan'
import { planHasFeature } from '@/lib/billing/features'
import { fetchPermissionCatalog, fetchRoles, roleErrorMessage, type PermissionDef, type RoleInput, type RoleSummary } from '@/lib/roles/roles'

export interface OrgRolesOverview {
  planName: string
  /** El plan permite crear y personalizar roles. */
  canCustomize: boolean
  /** Permisos que el usuario actual puede conceder (no puede dar lo que no tiene). */
  grantableKeys: string[]
  permissions: PermissionDef[]
  systemRoles: RoleSummary[]
  customRoles: RoleSummary[]
}

export async function getOrgRolesOverview(): Promise<OrgRolesOverview> {
  const { organizationId, permissions: held } = await requirePermission('roles.manage')
  const supabase = await createClient()

  const [permissions, roles, orgPlan] = await Promise.all([
    fetchPermissionCatalog(supabase),
    fetchRoles(supabase, organizationId),
    getOrgPlan(organizationId),
  ])

  return {
    planName: orgPlan.plan.name,
    canCustomize: orgPlan.plan.features.custom_roles === true,
    grantableKeys: [...held],
    permissions,
    systemRoles: roles.filter((r) => r.isSystem && r.isActive),
    customRoles: roles.filter((r) => !r.isSystem),
  }
}

export interface AssignableRole {
  id: string
  name: string
  isSystem: boolean
}

/** Roles que se pueden asignar a un miembro o a una invitación. */
export async function getAssignableRoles(): Promise<AssignableRole[]> {
  const { organizationId } = await requireAnyPermission(['users.view', 'users.create', 'users.update'])
  const supabase = await createClient()
  const roles = await fetchRoles(supabase, organizationId)
  return roles
    .filter((r) => r.isActive)
    .map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))
}

const roleSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(2, 'El nombre es requerido').max(60, 'Máximo 60 caracteres'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres').nullish(),
  sourceRoleId: z.string().uuid().nullish(),
  permissionKeys: z.array(z.enum(PERMISSION_KEYS)),
})

async function requireCustomRoles() {
  const context = await requirePermission('roles.manage')
  if (!(await planHasFeature(context.organizationId, 'custom_roles'))) {
    throw new ForbiddenError('Tu plan no incluye roles personalizados')
  }
  return context
}

/**
 * Crea o edita un rol de la organización. El guardado va por `save_role`
 * con la sesión del usuario: RLS vuelve a exigir el permiso, el plan y que
 * no se concedan permisos que el usuario no tiene.
 */
export async function saveOrgRole(input: RoleInput): Promise<{ id: string }> {
  const { organizationId } = await requireCustomRoles()
  const values = roleSchema.parse(input)
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('save_role', {
    p_role_id: (values.id ?? null) as string,
    p_organization_id: organizationId,
    p_name: values.name,
    p_description: values.description ?? '',
    p_source_role_id: (values.sourceRoleId ?? null) as string,
    p_permission_keys: values.permissionKeys,
  })
  if (error) throw new Error(roleErrorMessage(error))

  revalidatePath('/settings/roles')
  revalidatePath('/settings/users')
  return { id: data }
}

export async function deleteOrgRole(roleId: string): Promise<void> {
  const { organizationId } = await requireCustomRoles()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roles')
    .delete()
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .select('id')
  if (error) throw new Error(roleErrorMessage(error))
  if (!data?.length) throw new ForbiddenError()

  revalidatePath('/settings/roles')
  revalidatePath('/settings/users')
}

/** Marca como revisada la actualización del rol oficial del que partió la copia. */
export async function acknowledgeRoleUpdate(roleId: string): Promise<void> {
  const { organizationId } = await requireCustomRoles()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('roles')
    .update({ source_synced_at: new Date().toISOString() })
    .eq('id', roleId)
    .eq('organization_id', organizationId)
    .select('id')
  if (error) throw new Error(roleErrorMessage(error))
  if (!data?.length) throw new ForbiddenError()

  revalidatePath('/settings/roles')
}
