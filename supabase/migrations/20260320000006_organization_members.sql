-- =============================================================================
-- organization_members
-- =============================================================================

CREATE TABLE public.organization_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('ORG_ADMIN', 'ORG_USER')),
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: own row, ORG_ADMIN of same org, or SUPERADMIN
CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = auth.uid()
    OR is_org_admin(organization_id)
  );

CREATE POLICY "org_members_insert"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_admin(organization_id));

CREATE POLICY "org_members_update"
  ON public.organization_members FOR UPDATE TO authenticated
  USING  (is_superadmin() OR is_org_admin(organization_id))
  WITH CHECK (is_superadmin() OR is_org_admin(organization_id));

CREATE POLICY "org_members_delete"
  ON public.organization_members FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

GRANT ALL ON TABLE public.organization_members TO anon, authenticated, service_role;
