-- Add is_active flag to org-level banks and documents tables

ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
