'use server'

import { requireSuperAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { CanvasNode, WorkflowNode, GroupNode, WorkflowEdge } from '@/components/app/workflow-editor/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

interface DbWorkflowNode {
  id: string
  template_id: string
  node_id: string
  type: string
  title: string
  config: Record<string, unknown>
  position_x: number
  position_y: number
  parent_group_id: string | null
  created_at: string
}

interface DbWorkflowGroup {
  id: string
  template_id: string
  group_id: string
  title: string
  position_x: number
  position_y: number
  width: number
  height: number
}

interface DbWorkflowEdge {
  id: string
  template_id: string
  source_node_id: string
  target_node_id: string
  source_handle_id: string | null
  target_handle_id: string | null
  condition: Record<string, unknown> | null
}

/**
 * Loads a global workflow template (SUPERADMIN only).
 */
export async function loadAdminWorkflow(
  templateId: string,
): Promise<{ nodes: CanvasNode[]; edges: WorkflowEdge[] }> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const [{ data: dbNodes, error: nodesErr }, { data: dbGroups, error: groupsErr }, { data: dbEdges, error: edgesErr }] =
    await Promise.all([
      db
        .from('workflow_nodes')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: true }) as Promise<{
        data: DbWorkflowNode[] | null
        error: { message: string } | null
      }>,
      db
        .from('workflow_node_groups')
        .select('*')
        .eq('template_id', templateId) as Promise<{
        data: DbWorkflowGroup[] | null
        error: { message: string } | null
      }>,
      db
        .from('workflow_edges')
        .select('*')
        .eq('template_id', templateId) as Promise<{
        data: DbWorkflowEdge[] | null
        error: { message: string } | null
      }>,
    ])

  if (nodesErr) throw new Error(nodesErr.message)
  if (groupsErr) throw new Error(groupsErr.message)
  if (edgesErr) throw new Error(edgesErr.message)

  // Los grupos van primero — React Flow exige que un nodo padre aparezca
  // antes que sus hijos en el arreglo `nodes`.
  const groupNodes: GroupNode[] = (dbGroups ?? []).map((g) => ({
    id: g.group_id,
    type: 'group',
    position: { x: g.position_x, y: g.position_y },
    style: { width: g.width, height: g.height },
    data: { nodeId: g.group_id, title: g.title },
  }))

  const workflowNodes: WorkflowNode[] = (dbNodes ?? []).map((n) => ({
    id: n.node_id,
    type: n.type as WorkflowNode['type'],
    position: { x: n.position_x, y: n.position_y },
    ...(n.parent_group_id ? { parentId: n.parent_group_id, extent: 'parent' as const } : {}),
    data: {
      nodeId: n.node_id,
      type: n.type as WorkflowNode['data']['type'],
      title: n.title,
      config: n.config ?? {},
    },
  }))

  const edges: WorkflowEdge[] = (dbEdges ?? []).map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.source_handle_id ?? undefined,
    targetHandle: e.target_handle_id ?? undefined,
    type: 'bezier',
    animated: true,
    markerEnd: { type: 'arrowclosed' as const, width: 18, height: 18 },
    data: (e.condition as WorkflowEdge['data']) ?? undefined,
  }))

  return { nodes: [...groupNodes, ...workflowNodes], edges }
}

/**
 * Persists a global workflow template (SUPERADMIN only).
 */
export async function saveAdminWorkflow(
  templateId: string,
  nodes: CanvasNode[],
  edges: WorkflowEdge[],
): Promise<void> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const groupNodes = nodes.filter((n): n is GroupNode => n.type === 'group')
  const plainNodes = nodes.filter((n): n is WorkflowNode => n.type !== 'group')

  // Nodos primero (referencian a grupos vía parent_group_id).
  const { error: delNodesErr } = await db
    .from('workflow_nodes')
    .delete()
    .eq('template_id', templateId)

  if (delNodesErr) throw new Error((delNodesErr as { message: string }).message)

  const { error: delGroupsErr } = await db
    .from('workflow_node_groups')
    .delete()
    .eq('template_id', templateId)

  if (delGroupsErr) throw new Error((delGroupsErr as { message: string }).message)

  // Insert groups antes que nodos — la FK fk_node_parent_group necesita que
  // el grupo ya exista cuando se inserta un nodo con parent_group_id.
  if (groupNodes.length > 0) {
    const { error: groupsErr } = await db.from('workflow_node_groups').insert(
      groupNodes.map((g) => ({
        template_id: templateId,
        group_id: g.id,
        title: g.data.title,
        position_x: g.position.x,
        position_y: g.position.y,
        width: typeof g.style?.width === 'number' ? g.style.width : 240,
        height: typeof g.style?.height === 'number' ? g.style.height : 160,
      })),
    )
    if (groupsErr) throw new Error((groupsErr as { message: string }).message)
  }

  if (plainNodes.length > 0) {
    const { error: nodesErr } = await db.from('workflow_nodes').insert(
      plainNodes.map((n) => ({
        template_id: templateId,
        node_id: n.id,
        type: n.type,
        title: n.data.title as string,
        config: (n.data.config as object) ?? {},
        position_x: n.position.x,
        position_y: n.position.y,
        parent_group_id: n.parentId ?? null,
      })),
    )
    if (nodesErr) throw new Error((nodesErr as { message: string }).message)
  }

  if (edges.length > 0) {
    const { error: edgesErr } = await db.from('workflow_edges').insert(
      edges.map((e) => ({
        template_id: templateId,
        source_node_id: e.source,
        target_node_id: e.target,
        source_handle_id: e.sourceHandle ?? null,
        target_handle_id: e.targetHandle ?? null,
        condition: e.data ?? null,
      })),
    )
    if (edgesErr) throw new Error((edgesErr as { message: string }).message)
  }
}
