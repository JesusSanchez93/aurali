-- =============================================================================
-- Add document_name and storage_path columns to generated_documents
-- =============================================================================

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS document_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_path  TEXT;
