'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { buildWorkflowExportPayload, workflowExportPayloadSchema, type WorkflowExportPayload } from '@/lib/workflow/workflowExport'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

/**
 * Si `desiredName` ya existe entre los flujos globales, devuelve una
 * variante con sufijo " (1)", " (2)", etc. — el primer número libre. Mismo
 * criterio que resolveUniqueFormName en admin/form-builder/actions.ts.
 */
async function resolveUniqueWorkflowName(db: Supabase, desiredName: string): Promise<string> {
  const { data, error } = await db.from('workflow_templates').select('name').is('organization_id', null)
  if (error) throw new Error(error.message)

  const existingNames = new Set((data ?? []).map((row: { name: string }) => row.name))
  if (!existingNames.has(desiredName)) return desiredName

  let suffix = 1
  while (existingNames.has(`${desiredName} (${suffix})`)) {
    suffix += 1
  }
  return `${desiredName} (${suffix})`
}

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
    .select('id, name, description, is_default, is_legacy_form, icon_svg, gradient_color, gradient_color_to, created_at')
    .is('organization_id', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Array<{
    id: string
    name: string
    description: string | null
    is_default: boolean
    is_legacy_form: boolean
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
 * Duplicates a global workflow template (metadata + nodes + edges) under a
 * new name. The copy is always created as a non-legacy, dynamic-form-ready
 * template (is_legacy_form: false) — e.g. to fork "Fraudes Financieros" into
 * a "v2" that can get its own formulario via el Dynamic Form Builder without
 * touching the original in production.
 * SUPERADMIN only.
 */
export async function duplicateGlobalWorkflow(sourceId: string, name: string): Promise<{ id: string }> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: source, error: sourceErr } = await db
    .from('workflow_templates')
    .select('description, icon_svg, gradient_color, gradient_color_to')
    .eq('id', sourceId)
    .is('organization_id', null)
    .single()

  if (sourceErr || !source) throw new Error(sourceErr?.message ?? 'Flujo de origen no encontrado')

  const { data: newTemplate, error: createErr } = await db
    .from('workflow_templates')
    .insert({
      name,
      description: source.description,
      icon_svg: source.icon_svg,
      gradient_color: source.gradient_color,
      gradient_color_to: source.gradient_color_to,
      organization_id: null,
      is_default: false,
      is_legacy_form: false,
    })
    .select('id')
    .single()

  if (createErr) throw new Error(createErr.message)

  const [{ data: nodes, error: nodesErr }, { data: edges, error: edgesErr }] = await Promise.all([
    db.from('workflow_nodes').select('*').eq('template_id', sourceId),
    db.from('workflow_edges').select('*').eq('template_id', sourceId),
  ])

  if (nodesErr) throw new Error(nodesErr.message)
  if (edgesErr) throw new Error(edgesErr.message)

  if (nodes && nodes.length > 0) {
    const { error } = await db.from('workflow_nodes').insert(
      nodes.map((n: Record<string, unknown>) => ({
        template_id: newTemplate.id,
        node_id: n.node_id,
        type: n.type,
        title: n.title,
        config: n.config ?? {},
        position_x: n.position_x,
        position_y: n.position_y,
      })),
    )
    if (error) throw new Error(error.message)
  }

  if (edges && edges.length > 0) {
    const { error } = await db.from('workflow_edges').insert(
      edges.map((e: Record<string, unknown>) => ({
        template_id: newTemplate.id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        source_handle_id: e.source_handle_id,
        target_handle_id: e.target_handle_id,
        condition: e.condition,
      })),
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/workflows')
  return { id: newTemplate.id }
}

/**
 * Exporta un flujo global (metadata + nodos + edges) como payload portable —
 * pensado para moverlo a otro ambiente (dev → prod) u organización. No
 * incluye `id`/`template_id` (no son portables); `node_id` sí se conserva,
 * es el identificador estable que las conexiones usan para referenciarse.
 * SUPERADMIN only.
 */
export async function exportWorkflow(id: string): Promise<WorkflowExportPayload> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: template, error } = await db
    .from('workflow_templates')
    .select('name, description, icon_svg, gradient_color, gradient_color_to, is_legacy_form')
    .eq('id', id)
    .is('organization_id', null)
    .single()

  if (error || !template) throw new Error(error?.message ?? 'Flujo no encontrado')

  const [{ data: nodes, error: nodesErr }, { data: edges, error: edgesErr }] = await Promise.all([
    db
      .from('workflow_nodes')
      .select('node_id, type, title, config, position_x, position_y')
      .eq('template_id', id),
    db
      .from('workflow_edges')
      .select('source_node_id, target_node_id, source_handle_id, target_handle_id, condition')
      .eq('template_id', id),
  ])

  if (nodesErr) throw new Error(nodesErr.message)
  if (edgesErr) throw new Error(edgesErr.message)

  return buildWorkflowExportPayload(template, nodes ?? [], edges ?? [])
}

/**
 * Importa un flujo exportado como un flujo global NUEVO e independiente
 * (id propio) — mismo patrón de copia que duplicateGlobalWorkflow, pero
 * partiendo de un archivo en vez de un flujo existente en esta cuenta. Si el
 * nombre ya existe, se le agrega un sufijo " (1)", " (2)", etc.
 * SUPERADMIN only.
 */
export async function importWorkflow(payload: WorkflowExportPayload): Promise<{ id: string }> {
  await requireSuperAdmin()

  const parsed = workflowExportPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('El archivo no tiene el formato esperado de un flujo exportado.')
  }

  const supabase = await createClient()
  const db = supabase as Supabase

  const name = await resolveUniqueWorkflowName(db, parsed.data.name)

  const { data: newTemplate, error: createErr } = await db
    .from('workflow_templates')
    .insert({
      name,
      description: parsed.data.description,
      icon_svg: parsed.data.iconSvg,
      gradient_color: parsed.data.gradientColor,
      gradient_color_to: parsed.data.gradientColorTo,
      organization_id: null,
      is_default: false,
      is_legacy_form: parsed.data.isLegacyForm,
    })
    .select('id')
    .single()

  if (createErr) throw new Error(createErr.message)

  if (parsed.data.nodes.length > 0) {
    const { error } = await db.from('workflow_nodes').insert(
      parsed.data.nodes.map((n) => ({
        template_id: newTemplate.id,
        node_id: n.node_id,
        type: n.type,
        title: n.title,
        config: n.config ?? {},
        position_x: n.position_x,
        position_y: n.position_y,
      })),
    )
    if (error) throw new Error(error.message)
  }

  if (parsed.data.edges.length > 0) {
    const { error } = await db.from('workflow_edges').insert(
      parsed.data.edges.map((e) => ({
        template_id: newTemplate.id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        source_handle_id: e.source_handle_id,
        target_handle_id: e.target_handle_id,
        condition: e.condition,
      })),
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/workflows')
  return { id: newTemplate.id }
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
