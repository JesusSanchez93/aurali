-- =============================================================================
-- audit_logs
-- =============================================================================

CREATE TABLE public.audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id),
  user_id         UUID        REFERENCES public.profiles(id),
  action          TEXT,
  entity          TEXT,
  entity_id       UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "audit_logs_insert"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.audit_logs TO anon, authenticated, service_role;
