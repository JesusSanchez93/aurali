-- ============================================
-- MIGRATION: workflow_node_groups
-- Description: Agrupación visual de nodos en el editor de flujos (estilo
--   React Flow sub-flows) — puramente organizativo, el motor de ejecución
--   (lib/workflow/workflowRunner.ts) nunca consulta esta tabla.
-- Date: 2026-09-30
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.workflow_node_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  group_id    TEXT        NOT NULL,
  title       TEXT        NOT NULL DEFAULT 'Grupo',
  position_x  FLOAT       NOT NULL DEFAULT 0,
  position_y  FLOAT       NOT NULL DEFAULT 0,
  width       FLOAT       NOT NULL DEFAULT 240,
  height      FLOAT       NOT NULL DEFAULT 160,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, group_id)
);

ALTER TABLE public.workflow_nodes
  ADD COLUMN IF NOT EXISTS parent_group_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_node_parent_group'
  ) THEN
    ALTER TABLE public.workflow_nodes
      ADD CONSTRAINT fk_node_parent_group
      FOREIGN KEY (template_id, parent_group_id)
      REFERENCES public.workflow_node_groups(template_id, group_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2. ENABLE RLS
ALTER TABLE public.workflow_node_groups ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_workflow_node_groups_template_id
  ON public.workflow_node_groups(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_parent_group_id
  ON public.workflow_nodes(parent_group_id);

-- 4. CREATE POLICIES
-- Nota: `CREATE POLICY IF NOT EXISTS` no es sintaxis válida en PostgreSQL;
-- se usa un bloque DO idempotente en su lugar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workflow_node_groups' AND policyname = 'workflow_node_groups_manage') THEN
    CREATE POLICY "workflow_node_groups_manage"
      ON public.workflow_node_groups FOR ALL TO authenticated
      USING (
        is_superadmin()
        OR template_id IN (
          SELECT id FROM public.workflow_templates
          WHERE organization_id IS NULL OR is_org_member(organization_id)
        )
      );
  END IF;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.workflow_node_groups TO anon, authenticated, service_role;
