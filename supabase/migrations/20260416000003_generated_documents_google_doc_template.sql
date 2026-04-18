-- Adds google_doc_template_id to generated_documents so the workflow engine
-- can reference Google Doc templates alongside TipTap legal_templates.
-- Both columns are nullable — only one is set per row depending on the source.

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS google_doc_template_id UUID
    REFERENCES public.google_doc_templates(id) ON DELETE SET NULL;
