-- ============================================
-- MIGRATION: email_follow_ups_google_capture
-- Description: Habilita capture_mode='google' para el nodo wait_email_reply
--   cuando la organización tiene conectada una cuenta Google vía OAuth (en vez
--   de SMTP/IMAP) — lib/email/inboundReply.ts:determineReplyCapture detecta
--   la conexión y usa la Gmail API para leer el hilo en vez de abrir una
--   bandeja IMAP real. google_thread_id guarda el threadId que Gmail asigna
--   al enviar (GoogleEmailService.send), necesario porque Gmail sobrescribe
--   cualquier Message-ID propio — el poller busca respuestas dentro de ese
--   mismo hilo en vez de threading por Message-ID/In-Reply-To.
-- Date: 2026-09-16
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS google_thread_id text;

-- 2. UPDATE CHECK CONSTRAINT (CHECK no soporta IF NOT EXISTS — drop + recreate)
ALTER TABLE public.email_follow_ups
  DROP CONSTRAINT IF EXISTS email_follow_ups_capture_mode_check;

ALTER TABLE public.email_follow_ups
  ADD CONSTRAINT email_follow_ups_capture_mode_check
    CHECK (capture_mode IN ('webhook', 'imap', 'google'));
