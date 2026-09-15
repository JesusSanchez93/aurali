-- ============================================
-- MIGRATION: legal_processes_form_schema_fk
-- Description: Congela en legal_processes el form_schema publicado usado al
--   crear el caso (snapshot), para que publicar una nueva versión del
--   formulario no rompa un proceso a mitad de llenado. También habilita el
--   acceso anon al schema publicado de un proceso público en curso.
-- Date: 2026-09-11
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS form_schema_id UUID REFERENCES public.legal_process_form_schemas(id);

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_legal_processes_form_schema_id
  ON public.legal_processes(form_schema_id);

-- 4. CREATE POLICIES

-- Anon: puede leer el schema publicado referenciado por un proceso propio en curso
CREATE POLICY "form_schemas_select_anon_pending_process"
  ON public.legal_process_form_schemas
  FOR SELECT TO anon
  USING (
    is_published = true
    AND id IN (
      SELECT form_schema_id FROM public.legal_processes
      WHERE status = 'form_sent' AND form_schema_id IS NOT NULL
    )
  );
