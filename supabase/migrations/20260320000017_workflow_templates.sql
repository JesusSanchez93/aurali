-- =============================================================================
-- workflow_templates + workflow_steps (legacy linear)
-- =============================================================================

CREATE TABLE public.workflow_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  is_default      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.workflow_steps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  order_index INT         NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  step_type   public.workflow_step_type,
  actions     JSONB       NOT NULL DEFAULT '[]',
  next_status TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps     ENABLE ROW LEVEL SECURITY;

-- Templates: global (org IS NULL) visible to all; org-scoped visible to members
CREATE POLICY "workflow_templates_manage"
  ON public.workflow_templates FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR organization_id IS NULL
    OR is_org_member(organization_id)
  );

CREATE POLICY "workflow_steps_manage"
  ON public.workflow_steps FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR template_id IN (
      SELECT id FROM public.workflow_templates
      WHERE organization_id IS NULL
         OR is_org_member(organization_id)
    )
  );

GRANT ALL ON TABLE public.workflow_templates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.workflow_steps     TO anon, authenticated, service_role;
