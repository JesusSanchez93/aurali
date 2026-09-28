-- ============================================
-- MIGRATION: legal_process_comments
-- Description: Comentarios libres de los abogados sobre un proceso legal —
--   la parte "Comentarios" del feed "Comentarios y Actividad" del modal de
--   tarjeta del tablero (legal_process_board), estilo Trello. Se muestra
--   mezclado con audit_logs (ya existente, solo lectura/sistema) en el
--   cliente; esta tabla es la única fuente escribible por los abogados.
-- Date: 2026-09-28
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_comments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_process_id  UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  body              TEXT        NOT NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_comments ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys
CREATE INDEX IF NOT EXISTS idx_lp_comments_organization_id
  ON public.legal_process_comments(organization_id);

CREATE INDEX IF NOT EXISTS idx_lp_comments_created_by
  ON public.legal_process_comments(created_by);

-- 3.3 Feed de un proceso, ordenado por fecha
CREATE INDEX IF NOT EXISTS idx_lp_comments_process_created_at
  ON public.legal_process_comments(legal_process_id, created_at);

-- 4. CREATE POLICIES
--
-- Cualquier miembro de la organización puede ver y comentar (como en
-- Trello, cualquier persona del board puede participar); editar/borrar solo
-- el propio autor o un admin de la organización.

CREATE POLICY "lp_comments_select_org"
  ON public.legal_process_comments
  FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_comments_insert_org"
  ON public.legal_process_comments
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_comments_update_own"
  ON public.legal_process_comments
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id) OR created_by = auth.uid())
  WITH CHECK (is_superadmin() OR is_org_admin(organization_id) OR created_by = auth.uid());

CREATE POLICY "lp_comments_delete_own"
  ON public.legal_process_comments
  FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id) OR created_by = auth.uid());

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.legal_process_comments TO authenticated, service_role;
