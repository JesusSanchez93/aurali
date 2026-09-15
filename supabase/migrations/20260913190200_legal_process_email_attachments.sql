-- ============================================
-- MIGRATION: legal_process_email_attachments
-- Description: Documentos que el cliente adjuntó al RESPONDER un correo del
--   nodo 'wait_email_reply' (recibidos vía el webhook de Resend Inbound,
--   nunca subidos manualmente). Deliberadamente NO se reutiliza
--   generated_documents (documentos generados por el abogado) ni
--   document_signature_items (flujo de firma vía portal push-link) — es un
--   origen de datos distinto, con su propio ciclo de vida.
-- Date: 2026-09-13
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_email_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_process_id    UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  email_follow_up_id  UUID        NOT NULL REFERENCES public.email_follow_ups(id) ON DELETE CASCADE,

  filename            TEXT        NOT NULL,
  storage_path        TEXT        NOT NULL,
  file_url            TEXT,
  content_type        TEXT,
  size_bytes          INT,

  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_email_attachments ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys (ALWAYS)
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_organization_id
  ON public.legal_process_email_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_legal_process_id
  ON public.legal_process_email_attachments(legal_process_id);
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_email_follow_up_id
  ON public.legal_process_email_attachments(email_follow_up_id);

-- 3.3 Timestamps (para ORDER BY DESC en el detalle del proceso)
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_received_at
  ON public.legal_process_email_attachments(legal_process_id, received_at DESC);

-- 4. CREATE POLICIES
--
-- Dato interno (nunca lo toca el portal público del cliente) — solo
-- miembros de la organización dueña del proceso, mismo patrón que el resto
-- de tablas de legal_process_*.

CREATE POLICY "lp_email_attachments_select_org"
  ON public.legal_process_email_attachments
  FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_email_attachments_delete_org_admin"
  ON public.legal_process_email_attachments
  FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

-- 5. GRANT PERMISSIONS
--
-- El webhook de recepción usa el cliente admin/service_role (sin sesión de
-- usuario) para insertar, igual que el resto de escrituras del motor de
-- workflows — no se otorga INSERT/UPDATE a anon/authenticated.
GRANT ALL ON TABLE public.legal_process_email_attachments TO service_role;
GRANT SELECT ON TABLE public.legal_process_email_attachments TO authenticated;
