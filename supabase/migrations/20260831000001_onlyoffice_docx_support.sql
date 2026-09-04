-- ============================================
-- MIGRATION: onlyoffice_docx_support
-- Description: Añade soporte de plantillas .docx (ONLYOFFICE) a legal_templates
--              y generated_documents. Reemplaza el motor TipTap/Google Docs.
-- Date: 2026-08-31
-- ============================================

-- 1. ADD COLUMNS

ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS docx_storage_path text,
  ADD COLUMN IF NOT EXISTS docx_document_key text;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS docx_storage_path text,
  ADD COLUMN IF NOT EXISTS document_key text,
  ADD COLUMN IF NOT EXISTS edited_by_lawyer boolean NOT NULL DEFAULT false;

-- No new tables, no RLS/index/policy changes needed: the new columns fall
-- under the existing row-level policies of legal_templates and
-- generated_documents, and are not used in WHERE/ORDER BY clauses.
