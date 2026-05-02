// =============================================================================
// Raw database row types
// These mirror the schema from 20260314120000_node_based_workflow_engine.sql.
// They are defined here explicitly because supabase db pull has not been re-run
// after the migration, so the generated Database type doesn't include them yet.
// =============================================================================

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowStepRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

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

/** Valid status values for legal_processes.status */
export type LegalProcessStatus =
  | 'draft'
  | 'form_sent'
  | 'completed'
  | 'approved'
  | 'paid'
  | 'documents_approved'
  | 'documents_sent'
  | 'documents_received'
  | 'finished'
  | 'archived'
  | 'declined';

// ─── Database rows ─────────────────────────────────────────────────────────────

export interface WorkflowRunRow {
  id: string;
  template_id: string;
  legal_process_id: string;
  /** Logical node_id (text) of the node currently being processed or waiting */
  current_node_id: string | null;
  status: WorkflowRunStatus;
  created_at: string;
  completed_at: string | null;
}

export interface WorkflowNodeRow {
  id: string;
  template_id: string;
  /** Editor-assigned string identifier — used in edges and current_node_id */
  node_id: string;
  type: WorkflowNodeType;
  title: string;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface WorkflowEdgeRow {
  id: string;
  template_id: string;
  source_node_id: string;
  target_node_id: string;
  /** Optional condition. When null the edge is always followed. */
  condition: EdgeCondition | null;
}

export interface EdgeCondition {
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value?: unknown;
  label?: string;
}

export interface WorkflowStepRunRow {
  id: string;
  workflow_run_id: string;
  node_id: string;
  status: WorkflowStepRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
  executed_at: string | null;
}

export interface LegalProcessRow {
  id: string;
  organization_id: string | null;
  lawyer_id: string | null;
  email: string | null;
  status: string | null;
  workflow_run_id: string | null;
  document_type: string | null;
  document_number: string | null;
  access_token: string | null;
  /** Computed at runtime — not a DB column */
  form_url?: string;
}

export interface DocumentTemplateRow {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  tiptap_json: Record<string, unknown>;
  variables: Array<{ name: string; label: string; required?: boolean }>;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  document_type: string | null;
  document_number: string | null;
  professional_card_number?: string | null;
  professional_card_country?: string | null;
  professional_card_city?: string | null;
  signature_url?: string | null;
}

// ─── Execution types ───────────────────────────────────────────────────────────

/**
 * Rich context passed to every node executor.
 * Grows incrementally as the workflow progresses.
 */
export interface ExecutionContext {
  workflowRun: WorkflowRunRow;
  legalProcess: LegalProcessRow;
  /** Output produced by the immediately preceding node */
  previousOutput: Record<string, unknown>;
  /**
   * Flattened client data (name, email, phone, etc.)
   * Populated lazily by the runner when a node needs it.
   */
  clientData: Record<string, unknown>;
}

/** What each node executor returns to the runner */
export type NodeExecutionStatus = 'completed' | 'waiting' | 'failed';

export interface NodeResult {
  status: NodeExecutionStatus;
  /** Structured data forwarded to the next node as previousOutput */
  output: Record<string, unknown>;
  /** Only set when status === 'failed' */
  error?: string;
}
