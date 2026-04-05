-- ── legal_process_fees ────────────────────────────────────────────────────────
-- One record per process. Stores the agreed total fee.
CREATE TABLE public.legal_process_fees (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id  UUID           NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  organization_id   UUID           NOT NULL REFERENCES public.organizations(id),
  total_amount      NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  currency          TEXT           NOT NULL DEFAULT 'COP',
  notes             TEXT,
  created_by        UUID           DEFAULT auth.uid(),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (legal_process_id)
);

ALTER TABLE public.legal_process_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fees_select" ON public.legal_process_fees FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "fees_insert" ON public.legal_process_fees FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "fees_update" ON public.legal_process_fees FOR UPDATE TO authenticated
  USING  (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "fees_delete" ON public.legal_process_fees FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

GRANT ALL ON TABLE public.legal_process_fees TO anon, authenticated, service_role;

-- ── legal_process_payments ────────────────────────────────────────────────────
-- Multiple payments per process. Registered manually by the lawyer.
-- Future: gateway_provider / gateway_transaction_id will be populated
--         when the payment gateway is integrated in the client form.
CREATE TABLE public.legal_process_payments (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id       UUID           NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  organization_id        UUID           NOT NULL REFERENCES public.organizations(id),
  amount                 NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method         TEXT           NOT NULL, -- 'cash' | 'transfer' | 'card' | 'nequi' | 'daviplata' | 'other'
  payment_date           DATE           NOT NULL DEFAULT CURRENT_DATE,
  reference              TEXT,
  notes                  TEXT,
  registered_by          UUID           DEFAULT auth.uid() REFERENCES public.profiles(id),
  -- Reserved for future gateway integration (never populated manually):
  gateway_provider       TEXT,
  gateway_transaction_id TEXT,
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_process_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.legal_process_payments FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "payments_insert" ON public.legal_process_payments FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "payments_update" ON public.legal_process_payments FOR UPDATE TO authenticated
  USING  (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));
CREATE POLICY "payments_delete" ON public.legal_process_payments FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

GRANT ALL ON TABLE public.legal_process_payments TO anon, authenticated, service_role;
