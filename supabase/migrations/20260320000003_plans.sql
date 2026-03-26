-- =============================================================================
-- plans
-- =============================================================================

CREATE TABLE public.plans (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id   TEXT,
  name              TEXT,
  features          JSON,
  max_users         SMALLINT,
  max_templates     SMALLINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_all"
  ON public.plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "plans_superadmin_insert"
  ON public.plans FOR INSERT TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "plans_superadmin_update"
  ON public.plans FOR UPDATE TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "plans_superadmin_delete"
  ON public.plans FOR DELETE TO authenticated
  USING (is_superadmin());

GRANT ALL ON TABLE public.plans TO anon, authenticated, service_role;
