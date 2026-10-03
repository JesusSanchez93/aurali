'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrgPlan } from '@/lib/billing/getOrgPlan'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

/**
 * Returns all global workflow templates available for selection.
 */
export async function getAvailableWorkflows() {
  const supabase = await createClient()
  const db = supabase as Supabase

  const { data, error } = await db
    .from('workflow_templates')
    .select('id, name, description, is_default, is_legacy_form, required_catalogs, icon_svg, gradient_color, gradient_color_to')
    .is('organization_id', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    name: string
    description: string | null
    is_default: boolean
    is_legacy_form: boolean
    required_catalogs: string[]
    icon_svg: string | null
    gradient_color: string | null
    gradient_color_to: string | null
  }>
}

/**
 * Assigns a global workflow template to the user's current organization.
 * Replaces any existing active assignment.
 */
export async function selectWorkflowForOrg(workflowTemplateId: string) {
  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) throw new Error('Organization not found')

  const orgId = profile.current_organization_id

  // Deactivate any existing active workflow for this org
  await db
    .from('organization_workflows')
    .update({ is_active: false })
    .eq('organization_id', orgId)
    .eq('is_active', true)

  // Upsert the new selection
  const { error } = await db
    .from('organization_workflows')
    .upsert(
      {
        organization_id: orgId,
        workflow_template_id: workflowTemplateId,
        is_active: true,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,workflow_template_id' },
    )

  if (error) throw new Error(error.message)

  await supabase
    .from('profiles')
    .update({ onboarding_status: 'completed' })
    .eq('id', user.id)

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')
}

/**
 * Cuántos flujos puede activar la organización actual según su plan
 * (`null` = sin límite). Fuente única: `plans.max_workflows`.
 */
export async function getWorkflowSelectionLimit(): Promise<{ planName: string; maxWorkflows: number | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) throw new Error('Organization not found')

  const orgPlan = await getOrgPlan(profile.current_organization_id)
  return { planName: orgPlan.plan.name, maxWorkflows: orgPlan.plan.maxWorkflows }
}

/**
 * Cierra el onboarding dejando activos exactamente los flujos elegidos.
 * El tope del plan se valida aquí, no solo en la interfaz.
 */
export async function selectWorkflowsForOrg(workflowTemplateIds: string[]) {
  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) throw new Error('Organization not found')

  const orgId = profile.current_organization_id
  const ids = [...new Set(workflowTemplateIds)]

  if (ids.length === 0) throw new Error('Selecciona al menos un flujo de trabajo')

  const orgPlan = await getOrgPlan(orgId)
  const { maxWorkflows } = orgPlan.plan
  if (maxWorkflows !== null && ids.length > maxWorkflows) {
    throw new Error(`Tu plan ${orgPlan.plan.name} permite hasta ${maxWorkflows} flujos de trabajo activos.`)
  }

  // Solo plantillas globales: una organización no puede activar la de otra.
  const { data: templates, error: templatesError } = await db
    .from('workflow_templates')
    .select('id')
    .is('organization_id', null)
    .in('id', ids)

  if (templatesError) throw new Error(templatesError.message)
  if ((templates ?? []).length !== ids.length) throw new Error('Alguno de los flujos seleccionados no está disponible')

  const { error: deactivateError } = await db
    .from('organization_workflows')
    .update({ is_active: false })
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .not('workflow_template_id', 'in', `(${ids.join(',')})`)

  if (deactivateError) throw new Error(deactivateError.message)

  const assignedAt = new Date().toISOString()
  const { error } = await db
    .from('organization_workflows')
    .upsert(
      ids.map((workflowTemplateId) => ({
        organization_id: orgId,
        workflow_template_id: workflowTemplateId,
        is_active: true,
        assigned_by: user.id,
        assigned_at: assignedAt,
      })),
      { onConflict: 'organization_id,workflow_template_id' },
    )

  if (error) throw new Error(error.message)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_status: 'completed' })
    .eq('id', user.id)

  if (profileError) throw new Error(profileError.message)

  revalidatePath('/dashboard')
  revalidatePath('/onboarding')
}
