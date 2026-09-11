-- ============================================
-- MIGRATION: document_signature_requests
-- Description: Portal de firma de documentos — el nodo de workflow
--   send_documents crea una solicitud de firma con uno o más documentos;
--   el cliente accede vía un enlace de un solo uso protegido por un
--   código OTP enviado a su correo, sube los archivos firmados, y el
--   abogado los aprueba o rechaza (con motivo opcional) desde el dashboard.
-- Date: 2026-09-09
-- ============================================

-- 1. CREATE TABLE

CREATE TABLE IF NOT EXISTS public.document_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  legal_process_id uuid NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  client_email text NOT NULL,

  access_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  access_token_used boolean NOT NULL DEFAULT false,

  otp_code_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  otp_verified_at timestamptz,

  -- pending -> otp_sent -> verified -> uploaded -> approved | rejected
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'otp_sent', 'verified', 'uploaded', 'approved', 'rejected')),

  reviewed_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_signature_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  request_id uuid NOT NULL REFERENCES public.document_signature_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  generated_document_id uuid REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  document_name text NOT NULL,
  original_file_url text,

  signed_file_url text,
  signed_storage_path text,

  -- pending -> uploaded -> approved | rejected
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'approved', 'rejected')),

  rejection_reason text,
  uploaded_at timestamptz,
  reviewed_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS

ALTER TABLE public.document_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signature_items ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys (ALWAYS)
CREATE INDEX IF NOT EXISTS idx_document_signature_requests_organization_id
  ON public.document_signature_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_signature_requests_legal_process_id
  ON public.document_signature_requests(legal_process_id);

CREATE INDEX IF NOT EXISTS idx_document_signature_items_organization_id
  ON public.document_signature_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_signature_items_request_id
  ON public.document_signature_items(request_id);
CREATE INDEX IF NOT EXISTS idx_document_signature_items_generated_document_id
  ON public.document_signature_items(generated_document_id);

-- 3.2 Common queries (WHERE conditions)
CREATE INDEX IF NOT EXISTS idx_document_signature_requests_org_status
  ON public.document_signature_requests(organization_id, status);

-- 3.3 Timestamps (for ORDER BY DESC)
CREATE INDEX IF NOT EXISTS idx_document_signature_requests_created_at
  ON public.document_signature_requests(organization_id, created_at DESC);

-- 3.4 Token lookup (unauthenticated client access — must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_signature_requests_access_token
  ON public.document_signature_requests(access_token);

-- 4. CREATE POLICIES

-- document_signature_requests: SELECT/INSERT/UPDATE by org members (any lawyer
-- in the org can send/review), DELETE restricted to org admins. Unauthenticated
-- client actions (OTP verify, upload) always go through the admin/service-role
-- client (see lib/audit/logClientAction.ts pattern), so no anon policy is needed.

CREATE POLICY "Users can view signature requests from their organization"
  ON public.document_signature_requests
  FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Users can create signature requests in their organization"
  ON public.document_signature_requests
  FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Users can update signature requests in their organization"
  ON public.document_signature_requests
  FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org admins can delete signature requests"
  ON public.document_signature_requests
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());

CREATE POLICY "Users can view signature items from their organization"
  ON public.document_signature_items
  FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Users can create signature items in their organization"
  ON public.document_signature_items
  FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Users can update signature items in their organization"
  ON public.document_signature_items
  FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org admins can delete signature items"
  ON public.document_signature_items
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());

-- 5. GRANT PERMISSIONS

GRANT ALL ON TABLE public.document_signature_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.document_signature_items TO anon, authenticated, service_role;

-- Column-level lockdown: the OTP hash must never be readable by the browser
-- client, even for rows the requester could otherwise SELECT under RLS —
-- only the admin/service-role client (used for OTP send/verify) needs it.
REVOKE SELECT ON public.document_signature_requests FROM anon, authenticated;

GRANT SELECT (
  id, organization_id, legal_process_id, created_by, reviewed_by, client_email,
  access_token_expires_at, access_token_used, otp_expires_at, otp_attempts,
  otp_verified_at, status, reviewed_at, created_at, updated_at
) ON public.document_signature_requests TO anon, authenticated;
