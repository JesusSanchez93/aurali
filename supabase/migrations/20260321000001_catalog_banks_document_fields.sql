-- Add bank identity document fields to catalog_banks
ALTER TABLE public.catalog_banks
  ADD COLUMN IF NOT EXISTS document_type   TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT;
