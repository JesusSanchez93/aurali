-- ============================================
-- MIGRATION: legal_process_form_schemas
-- Description: Schema de formulario dinámico (draft/publish) asociado
--   directamente a un workflow_template (= tipo de proceso legal).
-- Date: 2026-09-11
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_form_schemas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  workflow_template_id  UUID        NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  updated_by            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  schema                JSONB       NOT NULL DEFAULT '{"sections": []}',
  version               INT         NOT NULL DEFAULT 1,
  is_published          BOOLEAN     NOT NULL DEFAULT false,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_form_schemas ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_form_schemas_workflow_template
  ON public.legal_process_form_schemas(workflow_template_id);

-- Solo un schema publicado por workflow_template a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_schemas_published
  ON public.legal_process_form_schemas(workflow_template_id)
  WHERE is_published;

-- 4. CREATE POLICIES

-- SELECT: superadmin (autoría) o cualquier authenticated org member de una org
-- que tenga ese workflow_template asignado (para poder ver el formulario del
-- workflow que usa su organización, aunque el template sea global).
CREATE POLICY "form_schemas_select_authenticated"
  ON public.legal_process_form_schemas
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR workflow_template_id IN (
      SELECT ow.workflow_template_id
      FROM public.organization_workflows ow
      WHERE is_org_member(ow.organization_id)
    )
  );

-- INSERT/UPDATE/DELETE: solo superadmin (el builder vive en admin/workflows, superadmin-only)
CREATE POLICY "form_schemas_write_superadmin"
  ON public.legal_process_form_schemas
  FOR ALL TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Nota: la policy de acceso anon (lectura del schema publicado de un proceso
-- público en curso) se crea en 20260911223003_legal_processes_form_schema_fk.sql,
-- porque depende de la columna legal_processes.form_schema_id agregada ahí.

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.legal_process_form_schemas TO anon, authenticated, service_role;
