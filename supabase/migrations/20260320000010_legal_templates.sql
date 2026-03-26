-- =============================================================================
-- legal_templates
-- =============================================================================

CREATE TABLE public.legal_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id),
  name            TEXT,
  content         JSONB,
  version         SMALLINT    NOT NULL DEFAULT 1,
  created_by      UUID        DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_templates_select"
  ON public.legal_templates FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_templates_insert"
  ON public.legal_templates FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "legal_templates_update"
  ON public.legal_templates FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_templates_delete"
  ON public.legal_templates FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.legal_templates TO anon, authenticated, service_role;
