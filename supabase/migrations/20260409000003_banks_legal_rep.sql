-- Add legal representative fields to catalog_banks and banks tables

ALTER TABLE public.catalog_banks
  ADD COLUMN IF NOT EXISTS legal_rep_first_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep_last_name  TEXT;

ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS legal_rep_first_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_rep_last_name  TEXT;
