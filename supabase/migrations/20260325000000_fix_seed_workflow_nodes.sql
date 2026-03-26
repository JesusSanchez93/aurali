-- =============================================================================
-- Fix broken edge in existing "Proceso Legal General" workflow
--
-- Bug: node-status-finished → status_update-1774333218530 (paid) is inverted.
--      Nothing points TO node-status-finished so it was unreachable and the
--      workflow was ending at status "paid" without setting "finished".
--
-- Fix:
--   REMOVE: node-status-finished → status_update-1774333218530 (wrong direction)
--   ADD:    status_update-1774333218530 → node-status-finished  (correct)
-- =============================================================================

DO $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id
  FROM public.workflow_templates
  WHERE name = 'Proceso Legal General' AND organization_id IS NULL
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE NOTICE 'Default workflow not found — skipping edge fix.';
    RETURN;
  END IF;

  -- Only applies to DBs seeded before this fix (builder-generated node IDs).
  -- Fresh installs already have the correct edges from the updated seed.
  IF NOT EXISTS (
    SELECT 1 FROM public.workflow_nodes
    WHERE template_id = v_template_id
      AND node_id = 'status_update-1774333218530'
  ) THEN
    RAISE NOTICE 'Node status_update-1774333218530 not found — fresh install, skipping.';
    RETURN;
  END IF;

  -- Remove the wrong edge (inverted direction)
  DELETE FROM public.workflow_edges
  WHERE template_id    = v_template_id
    AND source_node_id = 'node-status-finished'
    AND target_node_id = 'status_update-1774333218530';

  -- Add the correct edge: paid → finished
  INSERT INTO public.workflow_edges (template_id, source_node_id, target_node_id, condition)
  VALUES (v_template_id, 'status_update-1774333218530', 'node-status-finished', NULL)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Workflow edge fix applied for template %', v_template_id;
END $$;
