-- ============================================
-- MIGRATION: workflow_templates_legacy_form
-- Description: Marca workflow_templates que usan el formulario público
--   hardcoded actual (fraude bancario) en vez de un form_schema dinámico.
-- Date: 2026-09-11
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS is_legacy_form BOOLEAN NOT NULL DEFAULT false;

-- 2. BACKFILL: el único template real hoy ("Fraudes Financieros") usa el flujo legado
UPDATE public.workflow_templates
  SET is_legacy_form = true
  WHERE id = 'a91887dd-edbb-4e75-aa76-217977848177';
