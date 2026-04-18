-- Añade font_family, header_id y footer_id a google_doc_templates
-- para que el pipeline de generación de PDF respete la fuente y renderice
-- encabezado/pie de página igual que el pipeline TipTap.

ALTER TABLE public.google_doc_templates
  ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS header_id uuid REFERENCES public.document_headers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS footer_id uuid REFERENCES public.document_footers(id) ON DELETE SET NULL;
