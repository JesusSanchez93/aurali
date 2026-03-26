-- Add lawyer identity document fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS document_type   TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT;
