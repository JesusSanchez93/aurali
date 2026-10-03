-- ============================================
-- MIGRATION: support_control_broadcast
-- Description: Co-navegación del modo "tomar el control": la pantalla de la
--   organización sigue a la del superadmin (página, cursor, clics y scroll)
--   por un canal privado de Realtime Broadcast `support-control:<request_id>`.
--   Solo pueden escuchar y emitir en ese canal el superadmin que pidió el
--   acceso y los miembros de la organización, mientras la solicitud siga
--   aprobada en modo control.
-- Date: 2026-10-02
-- ============================================

-- 1. CREATE FUNCTION
CREATE OR REPLACE FUNCTION public.can_join_support_control(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF p_topic !~ '^support-control:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_request_id := substring(p_topic FROM 17)::uuid;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_access_requests r
    WHERE r.id = v_request_id
      AND r.status = 'approved'
      AND r.mode = 'control'
      AND (
        (r.requested_by = auth.uid() AND is_superadmin())
        OR is_org_member(r.organization_id)
      )
  );
END;
$$;

-- 2. CREATE POLICIES (realtime.messages ya tiene RLS habilitado)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Support control participants can receive') THEN
    CREATE POLICY "Support control participants can receive"
      ON realtime.messages FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND public.can_join_support_control(realtime.topic())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Support control participants can send') THEN
    CREATE POLICY "Support control participants can send"
      ON realtime.messages FOR INSERT TO authenticated
      WITH CHECK (
        realtime.messages.extension = 'broadcast'
        AND public.can_join_support_control(realtime.topic())
      );
  END IF;
END $$;

-- 3. GRANT PERMISSIONS
REVOKE ALL ON FUNCTION public.can_join_support_control(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_join_support_control(text) TO authenticated, service_role;
