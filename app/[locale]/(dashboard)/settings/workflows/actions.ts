'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Activa un workflow_template global adicional para la organización actual,
 * SIN desactivar los ya activos (a diferencia de selectWorkflowForOrg, que
 * reemplaza la única selección — usado en el onboarding inicial). Permite que
 * una organización maneje varios tipos de proceso legal en paralelo.
 */
export async function activateWorkflowForOrg(workflowTemplateId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');

  const { error } = await supabase
    .from('organization_workflows')
    .upsert(
      {
        organization_id: profile.current_organization_id,
        workflow_template_id: workflowTemplateId,
        is_active: true,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,workflow_template_id' },
    );

  if (error) throw new Error(error.message);

  revalidatePath('/settings/workflows');
}

/**
 * Desactiva un tipo de proceso para la organización, siempre que quede al
 * menos uno activo (createLegalProcessDraft requiere >= 1 workflow activo).
 */
export async function deactivateWorkflowForOrg(workflowTemplateId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');

  const { count } = await supabase
    .from('organization_workflows')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.current_organization_id)
    .eq('is_active', true);

  if ((count ?? 0) <= 1) {
    throw new Error('Debe quedar al menos un tipo de proceso activo');
  }

  const { error } = await supabase
    .from('organization_workflows')
    .update({ is_active: false })
    .eq('organization_id', profile.current_organization_id)
    .eq('workflow_template_id', workflowTemplateId);

  if (error) throw new Error(error.message);

  revalidatePath('/settings/workflows');
}

interface DbWorkflowNode {
  id: string; node_id: string; type: string; title: string
  config: Record<string, unknown>; position_x: number; position_y: number; created_at: string
}
interface DbWorkflowEdge {
  id: string; source_node_id: string; target_node_id: string
  source_handle_id: string | null; target_handle_id: string | null
  condition: Record<string, unknown> | null
}

/**
 * Carga los nodos/edges (solo lectura) de un workflow_template para el panel
 * ORG_ADMIN de "tipos de proceso activos" — mismo mapeo usado antes inline en
 * page.tsx, ahora reutilizable por template seleccionado.
 */
export async function getWorkflowGraphForOrgAdmin(templateId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: dbNodes }, { data: dbEdges }] = await Promise.all([
    db
      .from('workflow_nodes')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: true }) as Promise<{ data: DbWorkflowNode[] | null }>,
    db
      .from('workflow_edges')
      .select('*')
      .eq('template_id', templateId) as Promise<{ data: DbWorkflowEdge[] | null }>,
  ]);

  const nodes = (dbNodes ?? []).map((n: DbWorkflowNode) => ({
    id: n.node_id,
    type: n.type as 'start',
    position: { x: n.position_x, y: n.position_y },
    data: { nodeId: n.node_id, type: n.type as 'start', title: n.title, config: n.config ?? {} },
  }));

  const edges = (dbEdges ?? []).map((e: DbWorkflowEdge) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.source_handle_id ?? undefined,
    targetHandle: e.target_handle_id ?? undefined,
    type: 'bezier' as const,
    animated: true,
    markerEnd: { type: 'arrowclosed' as const, width: 18, height: 18 },
    data: (e.condition ?? undefined) as undefined,
  }));

  return { nodes, edges };
}

export async function getDocumentTemplates(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: profile } = await db
    .from('profiles')
    .select('current_organization_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (!profile?.current_organization_id) return [];

  const { data } = await db
    .from('legal_templates')
    .select('id, name')
    .eq('organization_id', profile.current_organization_id)
    .order('name', { ascending: true });

  return (data ?? []) as { id: string; name: string }[];
}

export async function updateEmailNodeConfig(
  templateId: string,
  nodeId: string,
  config: {
    subject?: string;
    body?: unknown;
    follow_up_value?: string;
    follow_up_unit?: string;
    reminder_count?: string;
    reminder_subject?: string;
    reminder_body?: unknown;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const { data: node, error: fetchError } = await db
    .from('workflow_nodes')
    .select('config')
    .eq('template_id', templateId)
    .eq('node_id', nodeId)
    .single();

  if (fetchError || !node) throw new Error('Nodo no encontrado');

  const { error } = await db
    .from('workflow_nodes')
    .update({ config: { ...node.config, ...config } })
    .eq('template_id', templateId)
    .eq('node_id', nodeId);

  if (error) throw new Error(error.message);

  revalidatePath('/settings/workflows');
}

export async function createWorkflowTemplate(name: string, description?: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.current_organization_id) throw new Error('Organization not found');

    const { data, error } = await supabase
        .from('workflow_templates')
        .insert({
            name,
            description,
            organization_id: profile.current_organization_id,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    revalidatePath('/settings/workflows');
    return data;
}

export async function updateWorkflowSteps(templateId: string, steps: any[]) {
    const supabase = await createClient();

    // In a production app, we should verify the template belongs to the user's org
    // For now, let's assume RLS handles it or we add a check if needed.

    // 1. Delete existing steps for this template to replace them (simplest way for DnD updates)
    // Alternatively, we could do an upsert but that requires more complex logic for deletions.
    const { error: deleteError } = await supabase
        .from('workflow_steps')
        .delete()
        .eq('template_id', templateId);

    if (deleteError) throw new Error(deleteError.message);

    // 2. Insert new steps with their order_index
    const stepsToInsert = steps.map((step, index) => ({
        ...step,
        template_id: templateId,
        order_index: index,
    }));

    const { error: insertError } = await supabase
        .from('workflow_steps')
        .insert(stepsToInsert);

    if (insertError) throw new Error(insertError.message);

    revalidatePath('/settings/workflows');
}

export async function deleteWorkflowTemplate(id: string) {
    const supabase = await createClient();

    const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/settings/workflows');
}
