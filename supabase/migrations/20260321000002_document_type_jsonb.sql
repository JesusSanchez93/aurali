-- Cambiar document_type de TEXT a JSONB en catalog_banks
ALTER TABLE public.catalog_banks
  ALTER COLUMN document_type TYPE JSONB USING
    CASE
      WHEN document_type IS NULL THEN NULL
      ELSE jsonb_build_object('slug', document_type)
    END;

-- Agregar columnas a banks (organización)
ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS document_type   JSONB,
  ADD COLUMN IF NOT EXISTS document_number TEXT;
