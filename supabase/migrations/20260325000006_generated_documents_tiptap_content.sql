-- Add tiptap_content to generated_documents so the lawyer can edit
-- the document preview with the TipTap editor before approving.
-- Stores the TipTap JSON with variables already substituted (real values, not {{placeholders}}).

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS tiptap_content JSONB;
