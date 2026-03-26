-- =============================================================================
-- legal_processes
-- =============================================================================

CREATE TABLE public.legal_processes (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID        REFERENCES public.organizations(id),
  status                  TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                              'draft', 'form_sent', 'completed', 'paid',
                              'documents_sent', 'documents_received', 'finished'
                            )),
  lawyer_id               UUID        REFERENCES public.profiles(id),
  document_type           TEXT,
  document_number         TEXT,
  email                   TEXT,
  access_token            TEXT,
  access_token_used       BOOLEAN     DEFAULT false,
  access_token_expires_at TIMESTAMPTZ,
  workflow_run_id         UUID,       -- FK added after workflow_runs is created
  created_by              UUID        DEFAULT auth.uid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_processes_organization_id ON public.legal_processes(organization_id);
CREATE INDEX idx_legal_processes_status          ON public.legal_processes(status);

ALTER TABLE public.legal_processes ENABLE ROW LEVEL SECURITY;

-- Authenticated org members
CREATE POLICY "legal_processes_select"
  ON public.legal_processes FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_processes_insert"
  ON public.legal_processes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (is_superadmin() OR is_org_member(organization_id))
  );

CREATE POLICY "legal_processes_update"
  ON public.legal_processes FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_processes_delete"
  ON public.legal_processes FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

-- Anon: public client form access (process must be in form_sent or draft)
CREATE POLICY "public_read_pending_process"
  ON public.legal_processes FOR SELECT TO anon
  USING (status = 'form_sent');

CREATE POLICY "public_client_can_update_pending_process"
  ON public.legal_processes FOR UPDATE TO anon
  USING (status = 'form_sent')
  WITH CHECK (status = 'form_sent');

GRANT ALL ON TABLE public.legal_processes TO anon, authenticated, service_role;
