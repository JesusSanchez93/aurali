-- ============================================
-- MIGRATION: legal_processes_board_realtime
-- Description: Habilita Supabase Realtime (postgres_changes) sobre
--   legal_processes para que el tablero refleje en vivo cuando otro
--   abogado mueve una tarjeta de columna, sin recargar.
-- Date: 2026-09-29
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'legal_processes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.legal_processes;
  END IF;
END $$;
