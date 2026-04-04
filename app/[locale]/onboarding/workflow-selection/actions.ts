'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
    .select('id, name, description, is_default, icon_svg')
    .is('organization_id', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    name: string
    description: string | null
    is_default: boolean
    icon_svg: string | null
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
