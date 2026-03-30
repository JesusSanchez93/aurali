-- Add SVG icon column to workflow_templates
-- Stores raw SVG markup for visual identity of each workflow template.
-- Only SUPERADMIN can write this column (enforced by existing RLS policies).

ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS icon_svg TEXT;
