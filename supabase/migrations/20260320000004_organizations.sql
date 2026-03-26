-- =============================================================================
-- organizations
-- =============================================================================

CREATE TABLE public.organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  legal_name  TEXT,
  nit         TEXT,
  address     TEXT,
  city        TEXT,
  country     TEXT        DEFAULT 'CO',
  region      TEXT,
  status      TEXT,
  created_by  UUID        DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR is_org_member(id)
  );

CREATE POLICY "organizations_insert"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_admin(id))
  WITH CHECK (is_superadmin() OR is_org_admin(id));

CREATE POLICY "organizations_delete"
  ON public.organizations FOR DELETE TO authenticated
  USING (is_superadmin());

GRANT ALL ON TABLE public.organizations TO anon, authenticated, service_role;
