-- =============================================================================
-- subscriptions
-- =============================================================================

CREATE TABLE public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID        REFERENCES public.organizations(id),
  plan_id                 UUID        REFERENCES public.plans(id),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  status                  TEXT,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "subscriptions_superadmin_insert"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "subscriptions_superadmin_update"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "subscriptions_superadmin_delete"
  ON public.subscriptions FOR DELETE TO authenticated
  USING (is_superadmin());

GRANT ALL ON TABLE public.subscriptions TO anon, authenticated, service_role;
