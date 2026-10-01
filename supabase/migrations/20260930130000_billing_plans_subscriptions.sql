-- ============================================
-- MIGRATION: billing_plans_subscriptions
-- Description: Planes (essential/professional), suscripciones manuales por
--   organización, registro de pagos y medición de uso mensual. No hay
--   pasarela de pago ni cobro automático — todo se gestiona desde el panel
--   de superadmin con transferencia/factura manual. Extiende la tabla
--   `plans` ya existente (orientada a Stripe, vacía, sin uso en código) en
--   vez de reemplazarla; la tabla `subscriptions` existente (también
--   orientada a Stripe, vacía, sin uso en código) queda huérfana sin tocar
--   y se reemplaza funcionalmente por `organization_subscriptions`.
-- Date: 2026-09-30
-- ============================================

-- 1. CREATE TABLE

-- 1.1 Extender catálogo de planes existente
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS price_monthly_cents integer,
  ADD COLUMN IF NOT EXISTS list_price_monthly_cents integer,
  ADD COLUMN IF NOT EXISTS max_monthly_processes integer,
  ADD COLUMN IF NOT EXISTS max_storage_gb integer,
  ADD COLUMN IF NOT EXISTS max_workflows integer,
  ADD COLUMN IF NOT EXISTS max_monthly_ai_uses integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_code_key'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_code_key UNIQUE (code);
  END IF;
END $$;

-- 1.2 Suscripción vigente de cada organización (reemplaza funcionalmente a
--     la tabla `subscriptions` existente, orientada a Stripe)
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  agreed_price_cents integer,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  notes text,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Historial de pagos manuales
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  amount_usd_cents integer NOT NULL,
  amount_cop numeric,
  trm_used numeric,
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'transfer',
  reference text,
  invoice_number text,
  period_start date,
  period_end date,
  notes text,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Medición de uso mensual por organización
CREATE TABLE IF NOT EXISTS public.usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Business fields
  period date NOT NULL,
  metric text NOT NULL CHECK (metric IN ('processes', 'ai_uses', 'emails')),
  value integer NOT NULL DEFAULT 0,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, period, metric)
);

-- 1.5 Seed idempotente de los dos planes
INSERT INTO public.plans (code, name, price_monthly_cents, list_price_monthly_cents, max_users, max_monthly_processes, max_storage_gb, max_workflows, max_monthly_ai_uses, updated_at)
VALUES
  ('essential', 'Esencial', 2500, 4900, 3, 50, 10, 3, 400, now()),
  ('professional', 'Profesional', 6900, 12900, 10, 250, 50, NULL, 2000, now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  list_price_monthly_cents = EXCLUDED.list_price_monthly_cents,
  max_users = EXCLUDED.max_users,
  max_monthly_processes = EXCLUDED.max_monthly_processes,
  max_storage_gb = EXCLUDED.max_storage_gb,
  max_workflows = EXCLUDED.max_workflows,
  max_monthly_ai_uses = EXCLUDED.max_monthly_ai_uses,
  updated_at = now();

-- 1.6 Backfill: toda organización existente queda en plan profesional,
--     activa, sin vencimiento (orgs internas/de prueba)
INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, billing_cycle, current_period_end, created_by)
SELECT o.id, (SELECT id FROM public.plans WHERE code = 'professional'), 'active', 'monthly', NULL, NULL
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_subscriptions os WHERE os.organization_id = o.id
);

-- 2. ENABLE RLS
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_monthly ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 organization_subscriptions
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id
  ON public.organization_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org_status
  ON public.organization_subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_current_period_end
  ON public.organization_subscriptions(current_period_end);

-- 3.2 subscription_payments
CREATE INDEX IF NOT EXISTS idx_subscription_payments_organization_id
  ON public.subscription_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
  ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_org_paid_at
  ON public.subscription_payments(organization_id, paid_at DESC);

-- 3.3 usage_monthly
CREATE INDEX IF NOT EXISTS idx_usage_monthly_organization_id
  ON public.usage_monthly(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_org_period
  ON public.usage_monthly(organization_id, period);

-- 4. CREATE POLICIES
-- Nota: `CREATE POLICY IF NOT EXISTS` no es sintaxis válida en PostgreSQL
-- (verificado contra PG17); se usan bloques DO idempotentes en su lugar.

DO $$
BEGIN
  -- 4.1 organization_subscriptions — lectura para miembros, escritura solo superadmin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Org members can view organization_subscriptions') THEN
    CREATE POLICY "Org members can view organization_subscriptions"
      ON public.organization_subscriptions FOR SELECT
      USING (is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Superadmin can create organization_subscriptions') THEN
    CREATE POLICY "Superadmin can create organization_subscriptions"
      ON public.organization_subscriptions FOR INSERT
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Superadmin can update organization_subscriptions') THEN
    CREATE POLICY "Superadmin can update organization_subscriptions"
      ON public.organization_subscriptions FOR UPDATE
      USING (is_superadmin())
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_subscriptions' AND policyname = 'Superadmin can delete organization_subscriptions') THEN
    CREATE POLICY "Superadmin can delete organization_subscriptions"
      ON public.organization_subscriptions FOR DELETE
      USING (is_superadmin());
  END IF;

  -- 4.2 subscription_payments — lectura para admin de la org o superadmin, escritura solo superadmin
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscription_payments' AND policyname = 'Org admins can view subscription_payments') THEN
    CREATE POLICY "Org admins can view subscription_payments"
      ON public.subscription_payments FOR SELECT
      USING (is_org_admin(organization_id) OR is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscription_payments' AND policyname = 'Superadmin can create subscription_payments') THEN
    CREATE POLICY "Superadmin can create subscription_payments"
      ON public.subscription_payments FOR INSERT
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscription_payments' AND policyname = 'Superadmin can update subscription_payments') THEN
    CREATE POLICY "Superadmin can update subscription_payments"
      ON public.subscription_payments FOR UPDATE
      USING (is_superadmin())
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscription_payments' AND policyname = 'Superadmin can delete subscription_payments') THEN
    CREATE POLICY "Superadmin can delete subscription_payments"
      ON public.subscription_payments FOR DELETE
      USING (is_superadmin());
  END IF;

  -- 4.3 usage_monthly — lectura para miembros; escritura solo vía service role (RPC increment_usage)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usage_monthly' AND policyname = 'Users can view usage_monthly from their organization') THEN
    CREATE POLICY "Users can view usage_monthly from their organization"
      ON public.usage_monthly FOR SELECT
      USING (is_org_member(organization_id));
  END IF;
END $$;

-- 4.4 Función RPC para incrementar uso de forma atómica (solo service_role)
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_organization_id uuid,
  p_period date,
  p_metric text,
  p_n integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value integer;
BEGIN
  INSERT INTO public.usage_monthly (organization_id, period, metric, value)
  VALUES (p_organization_id, p_period, p_metric, p_n)
  ON CONFLICT (organization_id, period, metric)
  DO UPDATE SET value = public.usage_monthly.value + EXCLUDED.value, updated_at = now()
  RETURNING value INTO v_value;

  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage(uuid, date, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, date, text, integer) TO service_role;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.organization_subscriptions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.subscription_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.usage_monthly TO anon, authenticated, service_role;
