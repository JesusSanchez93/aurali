-- ============================================
-- MIGRATION: email_connections_smtp
-- Description: Extiende email_connections (creada en
--   20260908123919_email_connections.sql) para soportar SMTP personalizado
--   como cuarto proveedor de correo, junto a aurali/google/microsoft.
--   También bloquea a nivel de columna la lectura de credenciales
--   sensibles (tokens OAuth y password SMTP cifrado) desde el cliente —
--   antes solo estaban protegidas por RLS de fila, no de columna.
-- Date: 2026-09-08
-- ============================================

-- 1. ADD COLUMNS

-- Identidad del remitente (aplica a smtp; el resto de proveedores derivan
-- el nombre del display name de la cuenta OAuth conectada).
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS display_name text;

-- Configuración SMTP — la contraseña nunca se guarda en texto plano, ver
-- lib/email/crypto.ts (AES-256-GCM, clave en SMTP_CREDENTIALS_ENCRYPTION_KEY).
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS smtp_port integer;
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS smtp_security text;
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS smtp_username text;
ALTER TABLE public.email_connections ADD COLUMN IF NOT EXISTS smtp_password_encrypted text;

-- 2. UPDATE CHECK CONSTRAINTS (additive — widens the allowed set, no data loss)

ALTER TABLE public.email_connections DROP CONSTRAINT IF EXISTS email_connections_provider_check;
ALTER TABLE public.email_connections ADD CONSTRAINT email_connections_provider_check
  CHECK (provider IN ('google', 'microsoft', 'smtp'));

ALTER TABLE public.email_connections DROP CONSTRAINT IF EXISTS email_connections_smtp_security_check;
ALTER TABLE public.email_connections ADD CONSTRAINT email_connections_smtp_security_check
  CHECK (smtp_security IS NULL OR smtp_security IN ('ssl_tls', 'starttls', 'none'));

ALTER TABLE public.email_connections DROP CONSTRAINT IF EXISTS email_connections_smtp_port_check;
ALTER TABLE public.email_connections ADD CONSTRAINT email_connections_smtp_port_check
  CHECK (smtp_port IS NULL OR (smtp_port > 0 AND smtp_port <= 65535));

-- 3. INDEXES — none needed beyond the existing organization_id/status ones;
--    SMTP rows are looked up the same way as OAuth rows.

-- 4. COLUMN-LEVEL PRIVILEGE LOCKDOWN
--
-- RLS in the prior migration only restricts which *rows* a member can read
-- (their own org) — it does not stop them reading *every column* of that
-- row through the browser-side Supabase client, including access_token,
-- refresh_token and smtp_password_encrypted. Server code always reads
-- through the service-role client (lib/email/connection.ts), so the
-- anon/authenticated roles never need those columns — revoke them at the
-- column level so a client-side query cannot return them even if RLS
-- would otherwise allow the row.
REVOKE SELECT ON public.email_connections FROM anon, authenticated;

GRANT SELECT (
  id, organization_id, created_by, provider, email, display_name, status,
  error_message, smtp_host, smtp_port, smtp_security, smtp_username,
  token_expires_at, created_at, updated_at
) ON public.email_connections TO anon, authenticated;

-- INSERT/UPDATE/DELETE stay table-level (already gated by the RLS policies
-- above); service_role keeps unrestricted access for the server-side flows.
