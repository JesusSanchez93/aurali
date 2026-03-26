import type { Node, Edge } from '@xyflow/react';

export type WorkflowNodeType =
  | 'start'
  | 'send_email'
  | 'client_form'
  | 'notify_lawyer'
  | 'manual_action'
  | 'generate_document'
  | 'send_documents'
  | 'status_update'
  | 'end';

export interface WorkflowNodeData extends Record<string, unknown> {
  nodeId: string;
  type: WorkflowNodeType;
  title: string;
  config: Record<string, unknown>;
}

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;

export interface EdgeCondition extends Record<string, unknown> {
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value?: string | number | boolean;
  label?: string;
}

export type WorkflowEdge = Edge<EdgeCondition>;
