-- =============================================================================
-- legal_process_clients
-- =============================================================================

CREATE TABLE public.legal_process_clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id      UUID        REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  organization_id       UUID        REFERENCES public.organizations(id),
  client_id             UUID        REFERENCES public.clients(id),
  document_id           UUID        REFERENCES public.documents(id),
  document_slug         TEXT,
  document_name         TEXT,
  document_number       TEXT,
  document_front_image  TEXT,
  document_back_image   TEXT,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  phone                 TEXT,
  address               TEXT,
  created_by            UUID        DEFAULT auth.uid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_process_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_process_clients_select"
  ON public.legal_process_clients FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_process_clients_insert"
  ON public.legal_process_clients FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "legal_process_clients_update"
  ON public.legal_process_clients FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

-- Anon: client filling the public form
CREATE POLICY "anon_update_legal_process_clients"
  ON public.legal_process_clients FOR UPDATE TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

GRANT ALL ON TABLE public.legal_process_clients TO anon, authenticated, service_role;
