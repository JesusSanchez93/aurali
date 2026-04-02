-- =============================================================================
-- Performance optimizations: missing FK indexes + N+1 RLS policy fixes
-- =============================================================================
-- Supabase best practices:
--   1. All FK columns referenced in RLS policies or JOIN conditions need indexes.
--   2. Subqueries in RLS policies execute per-row unless wrapped in (select ...)
--      which enables PostgreSQL to evaluate them once and cache the result.
-- =============================================================================

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- organization_members: both FK columns (used in every is_org_member() call)
-- Note: UNIQUE(organization_id, user_id) exists but only helps composite lookups.
CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(organization_id);

-- legal_templates
CREATE INDEX IF NOT EXISTS idx_legal_templates_org_id ON public.legal_templates(organization_id);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_org_id     ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_document_id ON public.clients(document_id);

-- banks
CREATE INDEX IF NOT EXISTS idx_banks_org_id ON public.banks(organization_id);

-- legal_processes: missing FKs + partial index on access_token for anon lookups
CREATE INDEX IF NOT EXISTS idx_legal_processes_lawyer_id       ON public.legal_processes(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_legal_processes_workflow_run_id ON public.legal_processes(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_legal_processes_access_token
  ON public.legal_processes(access_token)
  WHERE access_token IS NOT NULL;

-- legal_process_clients: all FK columns (legal_process_id used heavily in anon RLS)
CREATE INDEX IF NOT EXISTS idx_lp_clients_lp_id      ON public.legal_process_clients(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_lp_clients_org_id     ON public.legal_process_clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_lp_clients_client_id  ON public.legal_process_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_lp_clients_doc_id     ON public.legal_process_clients(document_id);

-- legal_process_banks: all FK columns
CREATE INDEX IF NOT EXISTS idx_lp_banks_lp_id   ON public.legal_process_banks(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_lp_banks_org_id  ON public.legal_process_banks(organization_id);
CREATE INDEX IF NOT EXISTS idx_lp_banks_bank_id ON public.legal_process_banks(bank_id);

-- workflow_templates
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org_id ON public.workflow_templates(organization_id);

-- workflow_runs: template_id (legal_process_id already indexed)
CREATE INDEX IF NOT EXISTS idx_workflow_runs_template_id ON public.workflow_runs(template_id);

-- generated_documents: template_id (legal_process_id already indexed)
CREATE INDEX IF NOT EXISTS idx_generated_docs_template_id ON public.generated_documents(template_id);

-- organization_workflows: single-column indexes (composite UNIQUE already exists)
CREATE INDEX IF NOT EXISTS idx_org_workflows_org_id              ON public.organization_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_workflows_workflow_template_id ON public.organization_workflows(workflow_template_id);

-- organization_invitations
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id     ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_invited_by ON public.organization_invitations(invited_by);

-- document_headers / document_footers
CREATE INDEX IF NOT EXISTS idx_doc_headers_org_id    ON public.document_headers(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_headers_created_by ON public.document_headers(created_by);
CREATE INDEX IF NOT EXISTS idx_doc_footers_org_id    ON public.document_footers(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_footers_created_by ON public.document_footers(created_by);


-- ─── RLS policy optimizations (N+1 → cached subqueries) ─────────────────────
-- Wrapping a subquery in (select ...) tells PostgreSQL to evaluate it once per
-- statement rather than once per row, eliminating the N+1 pattern.

-- ── legal_process_clients ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "legal_process_clients_insert" ON public.legal_process_clients;
CREATE POLICY "legal_process_clients_insert"
  ON public.legal_process_clients FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (select auth.uid()) AND active = true
    )
  );

DROP POLICY IF EXISTS "anon_update_legal_process_clients" ON public.legal_process_clients;
CREATE POLICY "anon_update_legal_process_clients"
  ON public.legal_process_clients FOR UPDATE TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

DROP POLICY IF EXISTS "anon_select_legal_process_clients" ON public.legal_process_clients;
CREATE POLICY "anon_select_legal_process_clients"
  ON public.legal_process_clients FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- ── legal_process_banks ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "legal_process_banks_insert" ON public.legal_process_banks;
CREATE POLICY "legal_process_banks_insert"
  ON public.legal_process_banks FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (select auth.uid()) AND active = true
    )
  );

DROP POLICY IF EXISTS "anon_update_legal_process_banks" ON public.legal_process_banks;
CREATE POLICY "anon_update_legal_process_banks"
  ON public.legal_process_banks FOR UPDATE TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

DROP POLICY IF EXISTS "anon_insert_legal_process_banks" ON public.legal_process_banks;
CREATE POLICY "anon_insert_legal_process_banks"
  ON public.legal_process_banks FOR INSERT TO anon
  WITH CHECK (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

DROP POLICY IF EXISTS "anon_select_legal_process_banks" ON public.legal_process_banks;
CREATE POLICY "anon_select_legal_process_banks"
  ON public.legal_process_banks FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- ── documents (public.documents, not storage.objects) ────────────────────────

DROP POLICY IF EXISTS "anon_select_documents" ON public.documents;
CREATE POLICY "anon_select_documents"
  ON public.documents FOR SELECT TO anon
  USING (
    organization_id IN (
      SELECT organization_id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );

-- ── banks ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_select_banks" ON public.banks;
CREATE POLICY "anon_select_banks"
  ON public.banks FOR SELECT TO anon
  USING (
    organization_id IN (
      SELECT organization_id FROM public.legal_processes WHERE access_token IS NOT NULL
    )
  );
