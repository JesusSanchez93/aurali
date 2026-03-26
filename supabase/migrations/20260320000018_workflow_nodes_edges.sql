-- =============================================================================
-- workflow_nodes + workflow_edges
-- =============================================================================

CREATE TABLE public.workflow_nodes (
  id          UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID                     NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  node_id     TEXT                     NOT NULL,
  type        public.workflow_node_type NOT NULL,
  title       TEXT                     NOT NULL,
  config      JSONB                    NOT NULL DEFAULT '{}',
  position_x  FLOAT                    NOT NULL DEFAULT 0,
  position_y  FLOAT                    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ              NOT NULL DEFAULT now(),
  UNIQUE (template_id, node_id)
);

CREATE TABLE public.workflow_edges (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID        NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  source_node_id   TEXT        NOT NULL,
  target_node_id   TEXT        NOT NULL,
  source_handle_id TEXT,
  target_handle_id TEXT,
  condition        JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT workflow_edges_no_self_loop CHECK (source_node_id <> target_node_id),
  CONSTRAINT fk_source_node FOREIGN KEY (template_id, source_node_id)
    REFERENCES public.workflow_nodes(template_id, node_id) ON DELETE CASCADE,
  CONSTRAINT fk_target_node FOREIGN KEY (template_id, target_node_id)
    REFERENCES public.workflow_nodes(template_id, node_id) ON DELETE CASCADE
);

CREATE INDEX idx_workflow_nodes_template_id ON public.workflow_nodes(template_id);
CREATE INDEX idx_workflow_edges_template_id ON public.workflow_edges(template_id);

ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_nodes_manage"
  ON public.workflow_nodes FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR template_id IN (
      SELECT id FROM public.workflow_templates
      WHERE organization_id IS NULL OR is_org_member(organization_id)
    )
  );

CREATE POLICY "workflow_edges_manage"
  ON public.workflow_edges FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR template_id IN (
      SELECT id FROM public.workflow_templates
      WHERE organization_id IS NULL OR is_org_member(organization_id)
    )
  );

GRANT ALL ON TABLE public.workflow_nodes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.workflow_edges TO anon, authenticated, service_role;
