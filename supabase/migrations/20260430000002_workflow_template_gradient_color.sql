-- ============================================
-- MIGRATION: workflow_template_gradient_color
-- Description: Adds gradient_color column to workflow_templates
-- Date: 2026-04-30
-- ============================================

ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS gradient_color text,
  ADD COLUMN IF NOT EXISTS gradient_color_to text;

UPDATE public.workflow_templates
SET gradient_color = '#7c3aed', gradient_color_to = '#0ea5e9'
WHERE id = 'a91887dd-edbb-4e75-aa76-217977848177';
