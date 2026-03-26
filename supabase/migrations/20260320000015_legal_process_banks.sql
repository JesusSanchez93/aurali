-- =============================================================================
-- legal_process_banks
-- =============================================================================

CREATE TABLE public.legal_process_banks (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id            UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  organization_id             UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_id                     UUID        REFERENCES public.banks(id) ON DELETE SET NULL,
  bank_slug                   TEXT,
  bank_name                   TEXT,
  last_4_digits               TEXT,
  bank_request                TEXT,
  bank_response               TEXT,
  latest_account_statement    TEXT,
  email                       TEXT,
  file_complait               BOOLEAN     NOT NULL DEFAULT false,
  complait_documents          TEXT,
  no_signal                   BOOLEAN     NOT NULL DEFAULT false,
  bank_notification           BOOLEAN     NOT NULL DEFAULT false,
  access_website              BOOLEAN     NOT NULL DEFAULT false,
  access_link                 BOOLEAN     NOT NULL DEFAULT false,
  used_to_operate_stolen_amount BOOLEAN   NOT NULL DEFAULT false,
  lost_card                   BOOLEAN     NOT NULL DEFAULT false,
  fraud_incident_summary      TEXT,
  created_by                  UUID        DEFAULT auth.uid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_process_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_process_banks_select"
  ON public.legal_process_banks FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "legal_process_banks_insert"
  ON public.legal_process_banks FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "legal_process_banks_update"
  ON public.legal_process_banks FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

-- Anon: client filling the public form
CREATE POLICY "anon_update_legal_process_banks"
  ON public.legal_process_banks FOR UPDATE TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

CREATE POLICY "anon_insert_legal_process_banks"
  ON public.legal_process_banks FOR INSERT TO anon
  WITH CHECK (
    legal_process_id IN (
      SELECT id FROM public.legal_processes
      WHERE status NOT IN ('completed', 'finished')
    )
  );

GRANT ALL ON TABLE public.legal_process_banks TO anon, authenticated, service_role;
