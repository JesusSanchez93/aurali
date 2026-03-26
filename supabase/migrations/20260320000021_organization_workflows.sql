-- =============================================================================
-- organization_workflows (asignación de workflow template a organización)
-- =============================================================================

CREATE TABLE public.organization_workflows (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_template_id UUID        NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by          UUID        REFERENCES public.profiles(id),
  UNIQUE (organization_id, workflow_template_id)
);

ALTER TABLE public.organization_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_workflows_superadmin"
  ON public.organization_workflows FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "org_workflows_select"
  ON public.organization_workflows FOR SELECT TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "org_workflows_insert"
  ON public.organization_workflows FOR INSERT TO authenticated
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "org_workflows_update"
  ON public.organization_workflows FOR UPDATE TO authenticated
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

GRANT ALL ON TABLE public.organization_workflows TO anon, authenticated, service_role;
