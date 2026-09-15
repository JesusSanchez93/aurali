-- ============================================
-- MIGRATION: email_attachments_notify
-- Description: Soporte para notificarle al cliente los documentos que el
--   abogado rechazó (legal_process_email_attachments) y reabrir la captura
--   de su corrección:
--   - subject: asunto del correo entrante que trajo el adjunto, capturado en
--     resolveEmailReply (antes se descartaba) — arma el "Re: {asunto}" del
--     correo de notificación.
--   - notified_at: marca qué documentos rechazados ya fueron incluidos en
--     una notificación, para que el botón "Notificar cliente" agrupe solo
--     los pendientes y no se pueda enviar dos veces.
-- Date: 2026-09-15
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.legal_process_email_attachments
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
