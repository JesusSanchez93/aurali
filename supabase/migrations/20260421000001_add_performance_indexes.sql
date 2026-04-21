-- ============================================
-- MIGRATION: add_performance_indexes
-- Description: Add composite, text-search and expression indexes to core tables
--              to cover multi-tenant queries, FK lookups and ordering patterns.
--              All indexes use IF NOT EXISTS — safe to re-run.
-- Date: 2026-04-21
-- ============================================

-- Enable trigram extension for text-search indexes (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- legal_processes
-- ============================================

-- Existing simple indexes: org_id, status, lawyer_id, workflow_run_id, access_token
-- Missing: composite org+status, org+created_at ordering, assigned_to FK

-- Composite for "show me processes of my org filtered by status" — the most common dashboard query
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_status
  ON public.legal_processes(organization_id, status);

-- Ordering: "latest processes for my org"
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_created_at
  ON public.legal_processes(organization_id, created_at DESC);

-- FK: assigned_to was added in a later migration with no index
CREATE INDEX IF NOT EXISTS idx_legal_processes_assigned_to
  ON public.legal_processes(assigned_to);

-- ============================================
-- clients
-- ============================================

-- Existing: org_id, document_id
-- Missing: email lookup, text search on name fields

-- Email lookup within an org (duplicate detection, invite flows)
CREATE INDEX IF NOT EXISTS idx_clients_org_email
  ON public.clients(organization_id, email);

-- Text search: find clients by first or last name (ILIKE queries in search bars)
CREATE INDEX IF NOT EXISTS idx_clients_first_name_trgm
  ON public.clients USING gin(first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_last_name_trgm
  ON public.clients USING gin(last_name gin_trgm_ops);

-- ============================================
-- banks
-- ============================================

-- Existing: org_id
-- Missing: text search on name, partial for active-only listing

-- Text search: bank autocomplete / search
CREATE INDEX IF NOT EXISTS idx_banks_name_trgm
  ON public.banks USING gin(name gin_trgm_ops);

-- Partial: most UI queries only show active banks
CREATE INDEX IF NOT EXISTS idx_banks_org_active
  ON public.banks(organization_id)
  WHERE is_active = true;

-- ============================================
-- workflow_runs
-- ============================================

-- Existing: legal_process_id, template_id
-- Missing: composite with status (used when checking if a process has an active run)

-- "Is there a running/pending run for this process?"
CREATE INDEX IF NOT EXISTS idx_workflow_runs_process_status
  ON public.workflow_runs(legal_process_id, status);

-- ============================================
-- workflow_step_runs
-- ============================================

-- Existing: workflow_run_id (simple)
-- Missing: composite with status, node_id lookup

-- "Find the waiting step for this run" — used in resume/retry flows
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run_status
  ON public.workflow_step_runs(workflow_run_id, status);

-- node_id lookup: finding which step corresponds to a given node
-- node_id is TEXT (not UUID), no implicit FK index
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_node_id
  ON public.workflow_step_runs(node_id);

-- ============================================
-- workflow_nodes
-- ============================================

-- Existing: template_id
-- Missing: expression index on node type for "find start node" queries

-- Composite: "find the start node for this template" — used when launching a workflow run
-- type is a native enum column (workflow_node_type), not JSONB
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_template_type
  ON public.workflow_nodes(template_id, type);

-- ============================================
-- workflow_edges
-- ============================================

-- Existing: template_id (simple)
-- Missing: composite indexes for source/target lookups
-- getNextNodes() loads all edges for a template, but partial lookups
-- by source node are the hot path in the execution engine.

-- Outgoing edges from a node: "what comes after node X in template T?"
-- FK constraint fk_source_node exists but does NOT create an index in PostgreSQL
CREATE INDEX IF NOT EXISTS idx_workflow_edges_template_source
  ON public.workflow_edges(template_id, source_node_id);

-- Incoming edges into a node (fan-in detection)
-- FK constraint fk_target_node exists but does NOT create an index in PostgreSQL
CREATE INDEX IF NOT EXISTS idx_workflow_edges_template_target
  ON public.workflow_edges(template_id, target_node_id);

-- ============================================
-- ai_variables
-- ============================================

-- Has UNIQUE(organization_id, key) which implicitly creates a composite index.
-- Still need a simple FK index on organization_id alone for RLS policy scans.

CREATE INDEX IF NOT EXISTS idx_ai_variables_org_id
  ON public.ai_variables(organization_id);

-- ============================================
-- google_doc_templates
-- ============================================

-- No indexes at all on this table — added in a separate migration with no indexes.

CREATE INDEX IF NOT EXISTS idx_google_doc_templates_org_id
  ON public.google_doc_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_google_doc_templates_created_by
  ON public.google_doc_templates(created_by);

-- ============================================
-- generated_documents
-- ============================================

-- Existing: legal_process_id, template_id
-- Missing: google_doc_template_id FK (added in a later migration, no index)

CREATE INDEX IF NOT EXISTS idx_generated_documents_google_doc_template_id
  ON public.generated_documents(google_doc_template_id);
