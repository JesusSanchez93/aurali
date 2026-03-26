-- =============================================================================
-- workflow_runs + workflow_step_runs
-- =============================================================================

CREATE TABLE public.workflow_runs (
  id               UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID                       NOT NULL REFERENCES public.workflow_templates(id),
  legal_process_id UUID                       NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  current_node_id  TEXT,
  status           public.workflow_run_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ                NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  CONSTRAINT chk_completed_at CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR status <> 'completed'
  )
);

CREATE TABLE public.workflow_step_runs (
  id              UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID                            NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id         TEXT                            NOT NULL,
  status          public.workflow_step_run_status NOT NULL DEFAULT 'pending',
  input           JSONB                           NOT NULL DEFAULT '{}',
  output          JSONB                           NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ                     NOT NULL DEFAULT now(),
  executed_at     TIMESTAMPTZ
);

-- Add FK from legal_processes to workflow_runs (now that workflow_runs exists)
ALTER TABLE public.legal_processes
  ADD CONSTRAINT fk_legal_processes_workflow_run
  FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE SET NULL;

CREATE INDEX idx_workflow_runs_legal_process_id ON public.workflow_runs(legal_process_id);
CREATE INDEX idx_workflow_step_runs_run_id       ON public.workflow_step_runs(workflow_run_id);

ALTER TABLE public.workflow_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_manage"
  ON public.workflow_runs FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR legal_process_id IN (
      SELECT id FROM public.legal_processes lp
      WHERE is_org_member(lp.organization_id)
    )
  );

CREATE POLICY "workflow_step_runs_manage"
  ON public.workflow_step_runs FOR ALL TO authenticated
  USING (
    is_superadmin()
    OR workflow_run_id IN (
      SELECT id FROM public.workflow_runs
    )
  );

GRANT ALL ON TABLE public.workflow_runs      TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.workflow_step_runs TO anon, authenticated, service_role;
