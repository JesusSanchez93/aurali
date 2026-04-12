-- Add inline header/footer content columns to legal_templates.
-- Replaces the external document_headers / document_footers references with
-- TipTap JSON stored directly in the template row.
-- header_id / footer_id are kept for backward-compat (read fallback).

ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS header_content JSONB,
  ADD COLUMN IF NOT EXISTS footer_content JSONB;
