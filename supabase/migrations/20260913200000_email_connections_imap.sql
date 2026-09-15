-- ============================================
-- MIGRATION: email_connections_imap
-- Description: Campos IMAP opcionales sobre email_connections — permiten
--   que una organización con SMTP conectado también habilite lectura real
--   de su bandeja (usado por el nodo 'wait_email_reply' en modo
--   capture_mode='imap', ver 20260913200100). Reutiliza smtp_username /
--   smtp_password_encrypted (misma cuenta de correo) — no se duplica el
--   secreto, solo se agrega host/puerto/seguridad específicos de IMAP
--   (suelen diferir de los de SMTP, ej. puerto 993 vs 587).
-- Date: 2026-09-13
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS imap_host text;

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS imap_port int;

ALTER TABLE public.email_connections
  ADD COLUMN IF NOT EXISTS imap_security text CHECK (imap_security IN ('ssl_tls', 'starttls', 'none'));
