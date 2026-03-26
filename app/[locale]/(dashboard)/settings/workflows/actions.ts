'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
  config: { subject?: string; body?: unknown; attach_document_template_ids?: string[] },
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
