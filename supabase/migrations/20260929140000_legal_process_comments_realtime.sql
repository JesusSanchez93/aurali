-- ============================================
-- MIGRATION: legal_process_comments_realtime
-- Description: Habilita Supabase Realtime (postgres_changes) sobre
--   legal_process_comments para que el chat de cada tarjeta del tablero
--   reciba comentarios nuevos/eliminados en vivo, sin recargar.
-- Date: 2026-09-29
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'legal_process_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.legal_process_comments;
  END IF;
END $$;
