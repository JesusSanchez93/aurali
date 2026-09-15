-- ============================================
-- MIGRATION: legal_process_form_schemas_name
-- Description: Cada formulario dinámico recibe su propio "name", independiente
--   del nombre del workflow_template al que pertenece. Necesario porque a
--   futuro un mismo tipo de proceso (workflow) podrá tener más de un
--   formulario — el listado de formularios debe mostrarse por su propio
--   nombre, no por el nombre del flujo (que queda como info secundaria).
-- Date: 2026-09-12
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.legal_process_form_schemas
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

-- Backfill de filas existentes con el nombre de su workflow_template
UPDATE public.legal_process_form_schemas AS fs
  SET name = wt.name
  FROM public.workflow_templates AS wt
  WHERE fs.workflow_template_id = wt.id AND fs.name = '';
