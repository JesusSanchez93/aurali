-- =============================================================================
-- document_headers + document_footers (per organization, TipTap JSON)
-- =============================================================================

CREATE TABLE public.document_headers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  content         JSONB       NOT NULL DEFAULT '{}',
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.document_footers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  content         JSONB       NOT NULL DEFAULT '{}',
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add header/footer references to legal_templates
ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS header_id UUID REFERENCES public.document_headers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS footer_id UUID REFERENCES public.document_footers(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.document_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_footers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_headers_manage"
  ON public.document_headers FOR ALL TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "doc_footers_manage"
  ON public.document_footers FOR ALL TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

GRANT ALL ON TABLE public.document_headers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.document_footers TO anon, authenticated, service_role;
