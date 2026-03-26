-- =============================================================================
-- clients
-- =============================================================================

CREATE TABLE public.clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        REFERENCES public.organizations(id),
  status                TEXT,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  phone                 TEXT,
  address               TEXT,
  document_id           UUID        REFERENCES public.documents(id),
  document_slug         TEXT,
  document_name         JSON,
  document_number       TEXT,
  document_front_image  TEXT,
  document_back_image   TEXT,
  created_by            UUID        DEFAULT auth.uid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, organization_id)
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select"
  ON public.clients FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "clients_insert"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_superadmin()
      OR organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

CREATE POLICY "clients_update"
  ON public.clients FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "clients_delete"
  ON public.clients FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.clients TO anon, authenticated, service_role;
