-- ============================================
-- MIGRATION: email_attachments_matched_document
-- Description: El nombre del archivo que el cliente adjunta al responder no
--   tiene por qué coincidir con el del documento original que se le envió
--   (lo renombra, lo comprime, lo escanea de nuevo, etc.) — se necesita un
--   vínculo explícito, elegido por el abogado, entre lo recibido
--   (legal_process_email_attachments) y el documento enviado originalmente
--   (generated_documents, is_preview=false) que ese adjunto responde.
-- Date: 2026-09-15
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.legal_process_email_attachments
  ADD COLUMN IF NOT EXISTS matched_document_id uuid
    REFERENCES public.generated_documents(id) ON DELETE SET NULL;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_lp_email_attachments_matched_document_id
  ON public.legal_process_email_attachments(matched_document_id);
