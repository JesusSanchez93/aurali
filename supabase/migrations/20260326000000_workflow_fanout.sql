-- Add active_node_ids to workflow_runs to track all parallel active nodes
-- during fan-out execution. current_node_id is kept for backwards compatibility.
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS active_node_ids TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows
UPDATE workflow_runs
SET active_node_ids = ARRAY[current_node_id]
WHERE current_node_id IS NOT NULL
  AND active_node_ids = '{}';
