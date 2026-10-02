'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { PERMISSION_KEYS } from '@/lib/auth/permission-keys'
import { fetchPermissionCatalog, fetchRoles, roleErrorMessage, type PermissionDef, type RoleInput, type RoleSummary } from '@/lib/roles/roles'

export async function getSystemRolesOverview(): Promise<{ roles: RoleSummary[]; permissions: PermissionDef[] }> {
  await requireSuperAdmin()
  const supabase = await createClient()
  const [roles, permissions] = await Promise.all([
    fetchRoles(supabase, null),
    fetchPermissionCatalog(supabase, { onlyActive: false }),
  ])
  return { roles, permissions }
}

const roleSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(2, 'El nombre es requerido').max(60, 'Máximo 60 caracteres'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres').nullish(),
  permissionKeys: z.array(z.enum(PERMISSION_KEYS)),
})

export async function saveSystemRole(input: RoleInput): Promise<{ id: string }> {
  await requireSuperAdmin()
  const values = roleSchema.parse(input)
  const supabase = await createClient()

  // El rol Administrador conserva siempre todos los permisos: solo se
  // actualizan sus datos descriptivos.
  if (values.id) {
    const { data: existing } = await supabase.from('roles').select('code').eq('id', values.id).maybeSingle()
    if (existing?.code === 'admin') {
      const { error } = await supabase
        .from('roles')
        .update({ name: values.name, description: values.description || null })
        .eq('id', values.id)
      if (error) throw new Error(roleErrorMessage(error))
      revalidatePath('/admin/roles')
      return { id: values.id }
    }
  }

  const { data, error } = await supabase.rpc('save_role', {
    p_role_id: (values.id ?? null) as string,
    p_organization_id: null as unknown as string,
    p_name: values.name,
    p_description: values.description ?? '',
    p_source_role_id: null as unknown as string,
    p_permission_keys: values.permissionKeys,
  })
  if (error) throw new Error(roleErrorMessage(error))

  revalidatePath('/admin/roles')
  return { id: data }
}

export async function setSystemRoleActive(roleId: string, isActive: boolean): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('roles')
    .update({ is_active: isActive })
    .eq('id', roleId)
    .is('organization_id', null)
  if (error) throw new Error(roleErrorMessage(error))

  revalidatePath('/admin/roles')
}

export async function deleteSystemRole(roleId: string): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { error } = await supabase.from('roles').delete().eq('id', roleId).is('organization_id', null)
  if (error) throw new Error(roleErrorMessage(error))

  revalidatePath('/admin/roles')
}

const permissionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, 'El nombre es requerido').max(60),
  description: z.string().trim().max(200).nullish(),
})

/** Solo datos descriptivos: la clave la referencia el código y no se edita. */
export async function updatePermission(input: z.input<typeof permissionSchema>): Promise<void> {
  await requireSuperAdmin()
  const values = permissionSchema.parse(input)
  const supabase = await createClient()

  const { error } = await supabase
    .from('permissions')
    .update({ name: values.name, description: values.description || null, updated_at: new Date().toISOString() })
    .eq('id', values.id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/roles')
}

export async function setPermissionActive(permissionId: string, isActive: boolean): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient()

  const { error } = await supabase
    .from('permissions')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', permissionId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/roles')
}
