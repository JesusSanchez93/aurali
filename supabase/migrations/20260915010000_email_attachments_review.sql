-- ============================================
-- MIGRATION: email_attachments_review
-- Description: legal_process_email_attachments pasa a ser el reemplazo del
--   flujo de firma vía portal manual (document_signature_items) para el caso
--   "el cliente responde el correo con los documentos adjuntos" — necesita el
--   mismo ciclo de revisión pending/approved/rejected por parte del abogado,
--   y permiso de UPDATE para que ese ciclo lo pueda escribir desde el
--   dashboard (antes solo el service_role insertaba, nunca se actualizaba).
-- Date: 2026-09-15
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.legal_process_email_attachments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 3. CREATE INDEXES

-- 3.4 Partial index (filtro común: pendientes por revisar)
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_pending
  ON public.legal_process_email_attachments(legal_process_id)
  WHERE status = 'pending';

-- 4. CREATE POLICIES
--
-- INSERT ya lo cubre el service_role (GRANT ALL, sin política de INSERT para
-- authenticated — el webhook/poller siempre corren con el cliente admin).
-- Falta UPDATE: el abogado aprueba/rechaza desde el detalle del proceso.
CREATE POLICY "lp_email_attachments_update_org"
  ON public.legal_process_email_attachments
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

-- 5. GRANT PERMISSIONS
GRANT UPDATE ON TABLE public.legal_process_email_attachments TO authenticated;
