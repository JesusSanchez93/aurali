-- ============================================
-- MIGRATION: email_follow_ups_reply_token
-- Description: Soporte para el nodo 'wait_email_reply' sobre la tabla
--   email_follow_ups ya existente (resolution_mode='reply' era un concepto
--   sin implementar — "no inbound-email detection yet"). Se agrega:
--   - reply_token: identifica de forma única e impredecible la dirección
--     Reply-To (reply+{token}@dominio-inbound) que arma el nodo al enviar el
--     correo — el webhook de recepción hace el match por este valor, nunca
--     por to_email/legal_process_id (evita que alguien adivine un token de
--     otra organización).
--   - requires_attachments: si está activo, el webhook de recepción no
--     resuelve la espera hasta que llegue una respuesta que traiga al menos
--     un adjunto (deja la fila en 'pending' e ignora respuestas sin
--     adjuntos, en vez de resolver con la primera que llegue).
-- Date: 2026-09-13
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS reply_token uuid UNIQUE DEFAULT gen_random_uuid();

ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS requires_attachments boolean NOT NULL DEFAULT false;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_email_follow_ups_reply_token
  ON public.email_follow_ups(reply_token);
