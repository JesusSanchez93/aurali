-- ============================================
-- MIGRATION: legal_process_form_responses
-- Description: Respuestas del cliente a formularios dinámicos, una fila por
--   sección del form_schema (upsert de avance parcial). Reemplaza, para
--   tipos de proceso nuevos, el patrón de columnas fijas usado hoy en
--   legal_process_clients/legal_process_banks (que se mantienen intactas
--   para el flujo legado).
-- Date: 2026-09-11
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_form_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  legal_process_id  UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  form_schema_id    UUID        REFERENCES public.legal_process_form_schemas(id) ON DELETE SET NULL,

  section_key       TEXT        NOT NULL,
  data              JSONB       NOT NULL DEFAULT '{}',
  submitted_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (legal_process_id, section_key)
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_form_responses ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_form_responses_legal_process_id
  ON public.legal_process_form_responses(legal_process_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_form_schema_id
  ON public.legal_process_form_responses(form_schema_id);

-- 4. CREATE POLICIES

-- SELECT: superadmin o miembros de la organización dueña del proceso
CREATE POLICY "form_responses_select_org"
  ON public.legal_process_form_responses
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp
      WHERE is_org_member(lp.organization_id)
    )
  );

-- Org members también pueden actualizar (correcciones internas) o eliminar (admin)
CREATE POLICY "form_responses_update_org"
  ON public.legal_process_form_responses
  FOR UPDATE TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_member(lp.organization_id)
    )
  )
  WITH CHECK (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_member(lp.organization_id)
    )
  );

CREATE POLICY "form_responses_delete_org_admin"
  ON public.legal_process_form_responses
  FOR DELETE TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_admin(lp.organization_id)
    )
  );

-- Anon: cliente externo puede insertar/actualizar sus propias respuestas
-- mientras el proceso siga en 'form_sent' (mismo criterio que legal_processes
-- y legal_process_clients)
CREATE POLICY "form_responses_insert_anon_pending_process"
  ON public.legal_process_form_responses
  FOR INSERT TO anon
  WITH CHECK (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  );

CREATE POLICY "form_responses_update_anon_pending_process"
  ON public.legal_process_form_responses
  FOR UPDATE TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  )
  WITH CHECK (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  );

CREATE POLICY "form_responses_select_anon_pending_process"
  ON public.legal_process_form_responses
  FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  );

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.legal_process_form_responses TO anon, authenticated, service_role;
