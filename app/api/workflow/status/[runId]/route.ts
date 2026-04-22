/**
 * GET /api/workflow/status/[runId]
 *
 * Returns the current status of a workflow run and its step runs,
 * enriched with node titles from the workflow template.
 *
 * Response:
 *   200 { status: string, steps: WorkflowStep[] }
 *   401 { error: string }
 *   404 { error: string }
 *   500 { error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:WORKFLOW_STATUS');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { runId } = await params;

  // Fetch the workflow run
  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .select('id, status, template_id, completed_at, current_node_id')
    .eq('id', runId)
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: 'Workflow run no encontrado' }, { status: 404 });
  }

  // Fetch step runs
  const { data: stepRuns, error: stepsError } = await supabase
    .from('workflow_step_runs')
    .select('id, node_id, status, created_at, executed_at')
    .eq('workflow_run_id', runId)
    .order('created_at', { ascending: true });

  if (stepsError) {
    logger.error('Failed to fetch step runs', stepsError, { runId });
    return NextResponse.json({ error: 'Error al obtener los pasos' }, { status: 500 });
  }

  // Fetch node titles from the workflow template
  const nodeIds = [...new Set((stepRuns ?? []).map((s) => s.node_id))];
  let nodeTitles: Record<string, string> = {};

  if (nodeIds.length > 0) {
    const { data: nodes } = await supabase
      .from('workflow_nodes')
      .select('node_id, title')
      .eq('template_id', run.template_id)
      .in('node_id', nodeIds);

    if (nodes) {
      nodeTitles = Object.fromEntries(nodes.map((n) => [n.node_id, n.title]));
    }
  }

  const steps = (stepRuns ?? []).map((step) => ({
    id: step.id,
    name: nodeTitles[step.node_id] ?? step.node_id,
    status: step.status,
    started_at: step.created_at,
    completed_at: step.executed_at,
  }));

  return NextResponse.json({
    status: run.status,
    completedAt: run.completed_at,
    steps,
  });
}
