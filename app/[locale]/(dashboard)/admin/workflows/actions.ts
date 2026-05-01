'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

/**
 * Returns all global workflow templates (organization_id = NULL).
 * Only callable by authenticated users; SUPERADMIN sees all.
 */
export async function getGlobalWorkflows() {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data, error } = await db
    .from('workflow_templates')
    .select('id, name, description, is_default, icon_svg, gradient_color, gradient_color_to, created_at')
    .is('organization_id', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Array<{
    id: string
    name: string
    description: string | null
    is_default: boolean
    icon_svg: string | null
    gradient_color: string | null
    gradient_color_to: string | null
    created_at: string
  }>
}

/**
 * Creates a new global workflow template (organization_id = NULL).
 * SUPERADMIN only.
 */
export async function createGlobalWorkflow(name: string, description?: string) {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data, error } = await db
    .from('workflow_templates')
    .insert({ name, description: description ?? null, organization_id: null })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/admin/workflows')
  return data as { id: string }
}

/**
 * Updates name, description, and icon_svg of a global workflow template.
 * SUPERADMIN only.
 */
export async function updateGlobalWorkflow(
  id: string,
  values: { name: string; description?: string | null; icon_svg?: string | null; gradient_color?: string | null; gradient_color_to?: string | null },
) {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { error } = await db
    .from('workflow_templates')
    .update({
      name: values.name,
      description: values.description ?? null,
      icon_svg: values.icon_svg ?? null,
      gradient_color: values.gradient_color ?? null,
      gradient_color_to: values.gradient_color_to ?? null,
    })
    .eq('id', id)
    .is('organization_id', null)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/workflows')
}

/**
 * Deletes a global workflow template.
 * SUPERADMIN only. Will cascade-delete all nodes, edges, and org assignments.
 */
export async function deleteGlobalWorkflow(id: string) {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { error } = await db
    .from('workflow_templates')
    .delete()
    .eq('id', id)
    .is('organization_id', null)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/workflows')
}
