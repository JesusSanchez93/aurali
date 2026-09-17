-- ============================================
-- MIGRATION: gmail_push_watch_state
-- Description: Reemplaza el polling de Gmail (capture_mode='google' en
--   email-inbound-imap-poll) por Gmail Push + Cloud Pub/Sub. Cada mailbox
--   Google conectado registra un users.watch() cuyo estado (historyId base +
--   expiración) se guarda en email_connections — el webhook
--   app/api/webhooks/gmail-push usa historyId para pedir solo el delta vía
--   users.history.list, y el cron app/api/cron/gmail-watch-renew renueva el
--   watch antes de que expire (máx. 7 días) y corre una resincronización de
--   respaldo con el mismo historyId, siguiendo la recomendación oficial de
--   Google de no depender 100% del push por si se pierde una notificación.
-- Date: 2026-09-17
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS google_watch_history_id text;

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS google_watch_expiration timestamptz;

-- 3. CREATE INDEXES
-- El webhook de Gmail Push resuelve por email_address (payload de Pub/Sub),
-- no por organization_id — antes no había índice porque nada más consultaba
-- por esta columna.
CREATE INDEX IF NOT EXISTS idx_email_connections_google_email
  ON public.email_connections(email)
  WHERE provider = 'google' AND status = 'connected';

-- El poller anterior recorría filas en memoria; el webhook necesita resolver
-- rápido "¿este threadId corresponde a un follow-up pendiente?" bajo el
-- tiempo de respuesta que espera Pub/Sub push.
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_google_thread_id
  ON public.email_follow_ups(google_thread_id)
  WHERE google_thread_id IS NOT NULL;
