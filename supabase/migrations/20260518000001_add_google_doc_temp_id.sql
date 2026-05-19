-- ============================================
-- MIGRATION: add_google_doc_temp_id
-- Description: Stores the temporary Google Docs copy ID created during preview generation,
--              so approval can export the already-substituted doc instead of regenerating.
-- Date: 2026-05-18
-- ============================================

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS google_doc_temp_id text;
