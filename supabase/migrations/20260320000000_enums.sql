-- =============================================================================
-- ENUMs
-- =============================================================================

CREATE TYPE public.workflow_step_type AS ENUM (
  'manual', 'client_input', 'payment', 'ai_generation', 'ai_wait',
  'internal_review', 'email', 'form', 'status_update', 'generate_document',
  'manual_action'
);

CREATE TYPE public.workflow_node_type AS ENUM (
  'start', 'end', 'manual', 'client_input', 'payment', 'ai_generation',
  'document_generation', 'notification', 'condition', 'delay',
  'email', 'form', 'status_update', 'generate_document', 'manual_action',
  'send_email', 'client_form', 'notify_lawyer', 'send_documents'
);

CREATE TYPE public.workflow_run_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TYPE public.workflow_step_run_status AS ENUM (
  'pending', 'running', 'completed', 'failed', 'skipped'
);
