-- Add preview support to generated_documents:
-- is_preview: true while awaiting lawyer approval; false (default) for final PDFs
-- html_content: stores the rendered HTML for preview display
-- file_url is made nullable (previews don't have a storage URL yet)

ALTER TABLE public.generated_documents
  ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS is_preview   BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS html_content TEXT;

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS document_name TEXT;
