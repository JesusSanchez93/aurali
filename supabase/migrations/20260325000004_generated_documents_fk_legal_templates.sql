-- Fix generated_documents.template_id FK:
-- The workflow engine stores legal_templates UUIDs, not document_templates UUIDs.
-- Drop the old FK, make the column nullable, and point to legal_templates.

ALTER TABLE public.generated_documents
  DROP CONSTRAINT generated_documents_template_id_fkey;

ALTER TABLE public.generated_documents
  ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE public.generated_documents
  ADD CONSTRAINT generated_documents_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.legal_templates(id) ON DELETE SET NULL;
