'use server';

import { createClient } from '@/lib/supabase/server';
import type { WorkflowNode, WorkflowEdge } from '@/components/app/workflow-editor/types';

// Raw DB row shapes — matches the migration schema.
// Using explicit types here because the Supabase generated types
// won't include these tables until `supabase db pull` is re-run.
interface DbWorkflowNode {
  id: string;
  template_id: string;
  node_id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

interface DbWorkflowEdge {
  id: string;
  template_id: string;
  source_node_id: string;
  target_node_id: string;
  condition: Record<string, unknown> | null;
}

export async function loadWorkflow(
  templateId: string,
): Promise<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: dbNodes, error: nodesErr }, { data: dbEdges, error: edgesErr }] =
    await Promise.all([
      db
        .from('workflow_nodes')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: true }) as Promise<{
        data: DbWorkflowNode[] | null;
        error: { message: string } | null;
      }>,
      db
        .from('workflow_edges')
        .select('*')
        .eq('template_id', templateId) as Promise<{
        data: DbWorkflowEdge[] | null;
        error: { message: string } | null;
      }>,
    ]);

  if (nodesErr) throw new Error(nodesErr.message);
  if (edgesErr) throw new Error(edgesErr.message);

  const nodes: WorkflowNode[] = (dbNodes ?? []).map((n) => ({
    id: n.node_id,
    type: n.type as WorkflowNode['type'],
    position: { x: n.position_x, y: n.position_y },
    data: {
      nodeId: n.node_id,
      type: n.type as WorkflowNode['data']['type'],
      title: n.title,
      config: n.config ?? {},
    },
  }));

  const edges: WorkflowEdge[] = (dbEdges ?? []).map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    type: 'bezier',
    animated: true,
    markerEnd: { type: 'arrowclosed' as const, width: 18, height: 18 },
    data: (e.condition as WorkflowEdge['data']) ?? undefined,
  }));

  return { nodes, edges };
}

export async function saveWorkflow(
  templateId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Delete existing nodes — FK cascade removes edges automatically
  const { error: delErr } = await db
    .from('workflow_nodes')
    .delete()
    .eq('template_id', templateId);

  if (delErr) throw new Error((delErr as { message: string }).message);

  // Insert nodes
  if (nodes.length > 0) {
    const { error: nodesErr } = await db.from('workflow_nodes').insert(
      nodes.map((n) => ({
        template_id: templateId,
        node_id: n.id,
        type: n.type,
        title: n.data.title as string,
        config: (n.data.config as object) ?? {},
        position_x: n.position.x,
        position_y: n.position.y,
      })),
    );
    if (nodesErr) throw new Error((nodesErr as { message: string }).message);
  }

  // Insert edges
  if (edges.length > 0) {
    const { error: edgesErr } = await db.from('workflow_edges').insert(
      edges.map((e) => ({
        template_id: templateId,
        source_node_id: e.source,
        target_node_id: e.target,
        condition: e.data ?? null,
      })),
    );
    if (edgesErr) throw new Error((edgesErr as { message: string }).message);
  }
}
