-- ============================================
-- MIGRATION: email_follow_ups
-- Description: Seguimiento de correos enviados por el nodo send_email del
--   workflow. Cuando el nodo activa "seguimiento", se registra una fila con
--   un plazo (deadline_at) y cómo se resuelve: 'reply' (el cliente responde
--   el correo — detección aún no implementada, requiere integración de
--   correo entrante) o 'receipt' (el cliente sube documentos vía el portal
--   de firma y el abogado los aprueba — resuelto automáticamente por
--   signature-actions.ts). No hay scheduler en el proyecto todavía: el
--   vencimiento se calcula de forma perezosa (status = 'pending' AND
--   deadline_at < now()) al leer el proceso, no por un job en background.
-- Date: 2026-09-10
-- ============================================

-- 1. CREATE TABLE

CREATE TABLE IF NOT EXISTS public.email_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_process_id uuid NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  signature_request_id uuid REFERENCES public.document_signature_requests(id) ON DELETE SET NULL,

  -- Business fields
  node_id text NOT NULL,
  to_email text NOT NULL,

  -- 'reply': se considera respondido cuando el cliente responde el correo
  --          (detección de correo entrante no implementada aún).
  -- 'receipt': se considera respondido cuando se aprueban todos los
  --          documentos subidos por el cliente (document_signature_items).
  resolution_mode text NOT NULL CHECK (resolution_mode IN ('reply', 'receipt')),
  requires_receipt boolean NOT NULL DEFAULT false,

  deadline_at timestamptz NOT NULL,

  -- pending -> responded | received | overdue
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'received', 'overdue')),

  resolved_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS

ALTER TABLE public.email_follow_ups ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys (ALWAYS)
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_organization_id
  ON public.email_follow_ups(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_legal_process_id
  ON public.email_follow_ups(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_workflow_run_id
  ON public.email_follow_ups(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_signature_request_id
  ON public.email_follow_ups(signature_request_id);

-- 3.2 Common queries (WHERE conditions)
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_org_status
  ON public.email_follow_ups(organization_id, status);

-- 3.3 Pending deadlines (used to compute overdue follow-ups on read)
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_pending_deadline
  ON public.email_follow_ups(deadline_at)
  WHERE status = 'pending';

-- 4. CREATE POLICIES

CREATE POLICY "Users can view email follow-ups from their organization"
  ON public.email_follow_ups
  FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Users can create email follow-ups in their organization"
  ON public.email_follow_ups
  FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Users can update email follow-ups in their organization"
  ON public.email_follow_ups
  FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org admins can delete email follow-ups"
  ON public.email_follow_ups
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());

-- 5. GRANT PERMISSIONS

GRANT ALL ON TABLE public.email_follow_ups TO anon, authenticated, service_role;
