-- ============================================
-- MIGRATION: form_responses_insert_authenticated
-- Description: legal_process_form_responses tenía policies de SELECT/UPDATE/
--   DELETE para authenticated, pero ninguna de INSERT — solo anon podía crear
--   filas nuevas. Si un usuario autenticado (ej. staff probando el formulario
--   público en el mismo navegador donde tiene sesión del dashboard) completa
--   una sección por primera vez, el upsert (INSERT) fallaba por RLS con
--   "error al guardar".
-- Date: 2026-09-12
-- ============================================

-- 4. CREATE POLICIES
CREATE POLICY "form_responses_insert_org"
  ON public.legal_process_form_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp WHERE is_org_member(lp.organization_id)
    )
  );
