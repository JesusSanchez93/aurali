-- ============================================
-- MIGRATION: legal_process_form_instances
-- Description: Representa el uso concreto de un formulario dentro de un
--   proceso legal. Permite que un mismo form_schema (ej. "Cuenta bancaria")
--   se use más de una vez en el mismo proceso (Cuenta bancaria #1, #2, #3),
--   algo que legal_processes.form_schema_id (relación 1:1) no soporta.
--   legal_processes.form_schema_id se conserva sin cambios como snapshot de
--   la instancia primaria/por defecto de cada proceso — se hace backfill de
--   una fila "primary" por cada proceso que ya tenía un form_schema_id.
-- Date: 2026-09-13
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_form_instances (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  legal_process_id  UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  form_schema_id    UUID        NOT NULL REFERENCES public.legal_process_form_schemas(id) ON DELETE CASCADE,

  code              TEXT        NOT NULL DEFAULT 'primary',
  label             TEXT,
  position          INT         NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'pending',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (legal_process_id, code)
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_form_instances ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_form_instances_legal_process_id
  ON public.legal_process_form_instances(legal_process_id);

CREATE INDEX IF NOT EXISTS idx_form_instances_form_schema_id
  ON public.legal_process_form_instances(form_schema_id);

-- Backfill: una instancia "primary" por cada proceso que ya tenía un
-- form_schema_id asignado (comportamiento hoy soportado, 1 formulario por
-- proceso).
INSERT INTO public.legal_process_form_instances (legal_process_id, form_schema_id, code, position)
SELECT lp.id, lp.form_schema_id, 'primary', 0
FROM public.legal_processes lp
WHERE lp.form_schema_id IS NOT NULL
ON CONFLICT (legal_process_id, code) DO NOTHING;

-- 4. CREATE POLICIES
--
-- Mismo patrón que legal_process_form_responses: org-member para
-- authenticated, y anon gateado por status='form_sent' del proceso dueño
-- (mismo criterio que legal_processes/legal_process_clients/form_responses).

CREATE POLICY "form_instances_select_org"
  ON public.legal_process_form_instances
  FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_member(lp.organization_id)
    )
  );

CREATE POLICY "form_instances_insert_org"
  ON public.legal_process_form_instances
  FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_member(lp.organization_id)
    )
  );

CREATE POLICY "form_instances_update_org"
  ON public.legal_process_form_instances
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

CREATE POLICY "form_instances_delete_org_admin"
  ON public.legal_process_form_instances
  FOR DELETE TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_admin(lp.organization_id)
    )
  );

CREATE POLICY "form_instances_select_anon_pending_process"
  ON public.legal_process_form_instances
  FOR SELECT TO anon
  USING (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  );

CREATE POLICY "form_instances_insert_anon_pending_process"
  ON public.legal_process_form_instances
  FOR INSERT TO anon
  WITH CHECK (
    legal_process_id IN (
      SELECT id FROM public.legal_processes WHERE status = 'form_sent'
    )
  );

CREATE POLICY "form_instances_update_anon_pending_process"
  ON public.legal_process_form_instances
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

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.legal_process_form_instances TO anon, authenticated, service_role;
