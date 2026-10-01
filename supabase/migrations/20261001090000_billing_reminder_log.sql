-- ============================================
-- MIGRATION: billing_reminder_log
-- Description: Registro de recordatorios de vencimiento de suscripción ya
--   enviados (7 días antes y el día del vencimiento) — evita duplicados en
--   el cron diario app/api/cron/billing-reminders. Se registra contra el
--   current_period_end/trial_ends_at vigente al momento del envío, así que
--   un nuevo ciclo de facturación (tras un pago) permite enviar de nuevo el
--   mismo tipo de recordatorio sin resetear ninguna bandera manualmente.
-- Date: 2026-10-01
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.billing_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  subscription_id uuid NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,

  -- Business fields
  reminder_type text NOT NULL CHECK (reminder_type IN ('7_days', 'due_today')),
  period_end timestamptz NOT NULL,

  -- Timestamps always last
  sent_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (subscription_id, reminder_type, period_end)
);

-- 2. ENABLE RLS
ALTER TABLE public.billing_reminder_log ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_billing_reminder_log_subscription_id
  ON public.billing_reminder_log(subscription_id);

-- 4. CREATE POLICIES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_reminder_log' AND policyname = 'Superadmin can view billing_reminder_log') THEN
    CREATE POLICY "Superadmin can view billing_reminder_log"
      ON public.billing_reminder_log FOR SELECT
      USING (is_superadmin());
  END IF;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.billing_reminder_log TO anon, authenticated, service_role;
