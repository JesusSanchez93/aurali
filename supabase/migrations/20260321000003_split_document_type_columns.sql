-- Reemplazar document_type JSONB por columnas separadas en catalog_banks
ALTER TABLE public.catalog_banks
  DROP COLUMN IF EXISTS document_type,
  ADD COLUMN IF NOT EXISTS document_slug TEXT,
  ADD COLUMN IF NOT EXISTS document_name JSONB;

-- Reemplazar document_type JSONB por columnas separadas en banks
ALTER TABLE public.banks
  DROP COLUMN IF EXISTS document_type,
  ADD COLUMN IF NOT EXISTS document_slug TEXT,
  ADD COLUMN IF NOT EXISTS document_name JSONB;
