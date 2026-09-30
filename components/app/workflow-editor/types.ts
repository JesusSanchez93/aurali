import type { Node, Edge } from '@xyflow/react';

export type WorkflowNodeType =
  | 'start'
  | 'send_email'
  | 'client_form'
  | 'notify_lawyer'
  | 'manual_action'
  | 'generate_document'
  | 'send_documents'
  | 'wait_email_reply'
  | 'status_update'
  | 'end';

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeId: string;
  type: WorkflowNodeType;
  title: string;
  config: Record<string, unknown>;
}

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;

/**
 * Contenedor visual (estilo React Flow sub-flows) para agrupar nodos en el
 * lienzo — puramente organizativo, nunca se persiste en workflow_nodes ni
 * llega al motor de ejecución (lib/workflow/), que solo conoce
 * WorkflowNodeType. Vive en su propia tabla (workflow_node_groups).
 */
export interface GroupNodeData extends Record<string, unknown> {
  nodeId: string;
  title: string;
}

export type GroupNode = Node<GroupNodeData, 'group'>;

/** Todo lo que puede vivir en el arreglo `nodes` del lienzo. */
export type CanvasNode = WorkflowNode | GroupNode;

export interface EdgeCondition extends Record<string, unknown> {
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value?: string | number | boolean;
  label?: string;
}

export type WorkflowEdge = Edge<EdgeCondition>;
