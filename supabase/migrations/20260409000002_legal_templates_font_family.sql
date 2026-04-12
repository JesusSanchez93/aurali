-- Add font_family column to legal_templates for per-template font selection
ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS font_family TEXT NOT NULL DEFAULT 'Inter';
