-- ============================================
-- MIGRATION: email_connections
-- Description: Configuración de correo por organización — permite conectar
--   una cuenta de correo propia (Google Workspace / Microsoft 365) que
--   reemplaza el correo interno de Aurali para las comunicaciones de la
--   organización. Sin conexión activa, Aurali usa su correo interno.
-- Date: 2026-09-08
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  error_message text,

  -- OAuth tokens — sensitive, never returned to the client (see lib/email/)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active connection per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_connections_org_active
  ON public.email_connections(organization_id)
  WHERE status = 'connected';

-- 2. ENABLE RLS
ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys (ALWAYS)
CREATE INDEX IF NOT EXISTS idx_email_connections_organization_id
  ON public.email_connections(organization_id);

CREATE INDEX IF NOT EXISTS idx_email_connections_created_by
  ON public.email_connections(created_by);

-- 3.2 Common queries (WHERE conditions)
CREATE INDEX IF NOT EXISTS idx_email_connections_org_status
  ON public.email_connections(organization_id, status);

-- 4. CREATE POLICIES

-- SELECT: is_org_member
DROP POLICY IF EXISTS "Users can view email connections from their organization" ON public.email_connections;
CREATE POLICY "Users can view email connections from their organization"
  ON public.email_connections
  FOR SELECT
  USING (is_org_member(organization_id));

-- INSERT: is_org_admin
DROP POLICY IF EXISTS "Org admins can create email connections" ON public.email_connections;
CREATE POLICY "Org admins can create email connections"
  ON public.email_connections
  FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- UPDATE: is_org_admin
DROP POLICY IF EXISTS "Org admins can update email connections" ON public.email_connections;
CREATE POLICY "Org admins can update email connections"
  ON public.email_connections
  FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- DELETE: is_org_admin OR is_superadmin
DROP POLICY IF EXISTS "Org admins can delete email connections" ON public.email_connections;
CREATE POLICY "Org admins can delete email connections"
  ON public.email_connections
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.email_connections TO anon, authenticated, service_role;
