-- =============================================================================
-- document_templates + generated_documents
-- =============================================================================

CREATE TABLE public.document_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  type            TEXT        NOT NULL,
  tiptap_json     JSONB       NOT NULL DEFAULT '{}',
  variables       JSONB       NOT NULL DEFAULT '[]',
  html_template   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.generated_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_process_id UUID        NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  template_id      UUID        NOT NULL REFERENCES public.document_templates(id),
  file_url         TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_templates_organization_id ON public.document_templates(organization_id);
CREATE INDEX idx_generated_documents_legal_process  ON public.generated_documents(legal_process_id);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_templates_manage"
  ON public.document_templates FOR ALL TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "generated_documents_manage"
  ON public.generated_documents FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp
      WHERE is_org_member(lp.organization_id)
    )
  );

GRANT ALL ON TABLE public.document_templates  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.generated_documents TO anon, authenticated, service_role;
