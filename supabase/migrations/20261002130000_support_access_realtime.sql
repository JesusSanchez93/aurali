-- ============================================
-- MIGRATION: support_access_realtime
-- Description: Habilita Supabase Realtime (postgres_changes) sobre
--   `notifications` y `organization_access_requests` para que el flujo de
--   acceso del equipo de Aurali se vea en vivo: la campana recibe
--   notificaciones nuevas al instante, el aviso de la organización aparece
--   o desaparece solo, y el superadmin sale de inmediato si le revocan el
--   acceso. Realtime respeta las políticas SELECT de RLS de cada tabla.
-- Date: 2026-10-02
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organization_access_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_access_requests;
  END IF;
END $$;
