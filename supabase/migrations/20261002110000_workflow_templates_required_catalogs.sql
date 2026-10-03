-- ============================================
-- MIGRATION: workflow_templates_required_catalogs
-- Description: Cada tipo de proceso legal declara qué listados propios usa
--   (hoy: bancos). Los listados globales (tipos de documento) aplican a
--   todas las organizaciones y no se guardan aquí. Una organización solo ve
--   el control de un listado si tiene activo un proceso que lo usa. Las
--   claves válidas viven en lib/catalogs/registry.ts.
-- Date: 2026-10-02
-- ============================================

ALTER TABLE public.workflow_templates
  ADD COLUMN IF NOT EXISTS required_catalogs text[] NOT NULL DEFAULT '{}';

-- Backfill: usan bancos el flujo heredado (formulario fijo con información
-- bancaria) y todo proceso con un formulario dinámico cuyo campo toma sus
-- opciones del listado de bancos.
UPDATE public.workflow_templates t
SET required_catalogs = array_append(t.required_catalogs, 'banks')
WHERE NOT ('banks' = ANY (t.required_catalogs))
  AND (
    t.is_legacy_form
    OR EXISTS (
      SELECT 1
      FROM public.legal_process_form_schemas s
      WHERE s.workflow_template_id = t.id
        AND s.schema::text LIKE '%"catalog_banks"%'
    )
  );

CREATE INDEX IF NOT EXISTS idx_workflow_templates_required_catalogs
  ON public.workflow_templates USING gin (required_catalogs);
