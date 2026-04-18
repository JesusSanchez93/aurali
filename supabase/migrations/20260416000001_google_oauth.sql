-- ─── Google OAuth ──────────────────────────────────────────────────────────────
-- Almacena tokens OAuth 2.0 de Google por organización para acceso a Google Docs.

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token    TEXT        NOT NULL,
  refresh_token   TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  google_email    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_oauth_tokens_org_members_select"
  ON public.google_oauth_tokens FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "google_oauth_tokens_org_admin_insert"
  ON public.google_oauth_tokens FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "google_oauth_tokens_org_admin_update"
  ON public.google_oauth_tokens FOR UPDATE
  USING (is_org_admin(organization_id));

CREATE POLICY "google_oauth_tokens_org_admin_delete"
  ON public.google_oauth_tokens FOR DELETE
  USING (is_org_admin(organization_id));

GRANT ALL ON TABLE public.google_oauth_tokens TO anon, authenticated, service_role;

-- ─── Google Doc Templates ───────────────────────────────────────────────────────
-- Plantillas que usan un Google Doc como fuente de contenido (enlace en vivo).

CREATE TABLE IF NOT EXISTS public.google_doc_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  google_doc_id   TEXT        NOT NULL,
  description     TEXT,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_doc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_doc_templates_org_members_select"
  ON public.google_doc_templates FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "google_doc_templates_org_members_insert"
  ON public.google_doc_templates FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "google_doc_templates_org_members_update"
  ON public.google_doc_templates FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "google_doc_templates_org_admin_delete"
  ON public.google_doc_templates FOR DELETE
  USING (is_org_admin(organization_id));

GRANT ALL ON TABLE public.google_doc_templates TO anon, authenticated, service_role;
