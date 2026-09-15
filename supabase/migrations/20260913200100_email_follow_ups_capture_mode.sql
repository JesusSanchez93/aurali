-- ============================================
-- MIGRATION: email_follow_ups_capture_mode
-- Description: Marca qué mecanismo debe resolver cada espera de respuesta:
--   'webhook' (Reply-To de Aurali + Resend Inbound, mecanismo original) o
--   'imap' (lectura real de la bandeja SMTP de la organización, nuevo). El
--   nodo wait_email_reply decide cuál usar según si la organización
--   completó los campos IMAP (email_connections.imap_host/imap_port).
-- Date: 2026-09-13
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'webhook'
    CHECK (capture_mode IN ('webhook', 'imap'));
