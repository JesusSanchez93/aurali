-- =============================================================================
-- banks (bancos por organización)
-- =============================================================================

CREATE TABLE public.banks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id),
  code            TEXT,
  slug            TEXT,
  name            TEXT,
  created_by      UUID        DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banks_select"
  ON public.banks FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "banks_insert"
  ON public.banks FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "banks_update"
  ON public.banks FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "banks_delete"
  ON public.banks FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.banks TO anon, authenticated, service_role;
