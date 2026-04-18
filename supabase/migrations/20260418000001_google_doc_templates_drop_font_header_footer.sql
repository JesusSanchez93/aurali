-- Remove font_family, header_id and footer_id from google_doc_templates.
-- These fields are no longer used: the template is purely a reference to the
-- Google Doc; font, header and footer come from the document itself.

ALTER TABLE public.google_doc_templates
  DROP COLUMN IF EXISTS font_family,
  DROP COLUMN IF EXISTS header_id,
  DROP COLUMN IF EXISTS footer_id;
