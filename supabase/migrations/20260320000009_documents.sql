-- =============================================================================
-- documents (tipos de documento por organización)
-- =============================================================================

CREATE TABLE public.documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id),
  slug            TEXT,
  name            JSON,
  created_by      UUID        DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select"
  ON public.documents FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "documents_update"
  ON public.documents FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "documents_delete"
  ON public.documents FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.documents TO anon, authenticated, service_role;
