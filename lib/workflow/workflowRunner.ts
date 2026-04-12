/**
 * workflowRunner.ts
 *
 * Orchestrates the execution of a node-based workflow.
 *
 * Public API
 * ──────────
 *   startWorkflow(templateId, legalProcessId)
 *     Called when a legal process is created. Creates a workflow_run record,
 *     finds the start node, and begins sequential execution.
 *
 *   resumeWorkflow(workflowRunId, input?)
 *     Called when a paused step (form | manual_action) is completed.
 *     Marks the current step done, then continues from the next node.
 *
 *   cancelWorkflow(workflowRunId)
 *     Hard-stops a running or paused workflow.
 *
 * Execution model
 * ───────────────
 *   • "Instant" nodes (start, email, status_update, generate_document,
 *     notification, end) execute synchronously and chain to the next node.
 *   • "Blocking" nodes (form, manual_action) return status='waiting'.
 *     The runner persists this state and exits. Execution resumes via
 *     resumeWorkflow() when the user completes the action.
 *   • A MAX_STEPS guard prevents infinite cycles.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { executeNode, getNextNodes } from './nodeExecutors';
import type {
  WorkflowRunRow,
  WorkflowNodeRow,
  WorkflowEdgeRow,
  WorkflowStepRunRow,
  LegalProcessRow,
  ExecutionContext,
} from './types';

/** Hard cap on sequential node executions per run to prevent infinite loops */
const MAX_STEPS = 100;

// =============================================================================
// Public API
// =============================================================================

export async function startWorkflow(
  templateId: string,
  legalProcessId: string,
): Promise<{ workflowRunId: string }> {
  const supabase = await createClient({ admin: true });

  // 1. Load the legal process
  const legalProcess = await fetchLegalProcess(legalProcessId, supabase);

  // 2. Load the full graph (nodes + edges) for this template
  const { nodes, edges } = await fetchGraph(templateId, supabase);

  if (nodes.length === 0) {
    throw new Error(`El template ${templateId} no tiene nodos definidos`);
  }

  // 3. Locate the start node
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('El workflow no tiene un nodo de inicio (type: start)');
  }

  // 4. Create the workflow_run record
  const { data: run, error: runErr } = await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('workflow_runs')
    .insert({
      template_id: templateId,
      legal_process_id: legalProcessId,
      current_node_id: startNode.node_id,
      status: 'running',
    })
    .select('*')
    .single() as { data: WorkflowRunRow | null; error: { message: string } | null };

  if (runErr || !run) throw new Error(runErr?.message ?? 'Error al crear workflow_run');

  // 5. Back-link the run to the legal process
  await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('legal_processes')
    .update({ workflow_run_id: run.id })
    .eq('id', legalProcessId);

  // Audit: workflow started
  void (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('audit_logs')
    .insert({
      organization_id: legalProcess.organization_id,
      user_id: legalProcess.lawyer_id,
      action: 'workflow_started',
      entity: 'legal_process',
      entity_id: legalProcessId,
      metadata: { workflow_run_id: run.id, template_id: templateId },
    });

  // 6. Load client data for variable substitution
  const clientData = await fetchClientData(legalProcessId, supabase);

  // 7. Start executing from the start node
  const context: ExecutionContext = {
    workflowRun: run,
    legalProcess,
    previousOutput: {},
    clientData,
  };

  await runFromNode(startNode, nodes, edges, context, supabase, 0);

  return { workflowRunId: run.id };
}

// -----------------------------------------------------------------------------

export async function resumeWorkflow(
  workflowRunId: string,
  input: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  // 1. Load the run
  const { data: run, error: runErr } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', workflowRunId)
    .single() as { data: WorkflowRunRow | null; error: { message: string } | null };

  if (runErr || !run) throw new Error(runErr?.message ?? 'workflow_run no encontrado');
  if (run.status !== 'running') {
    throw new Error(`No se puede reanudar un workflow con estado "${run.status}"`);
  }
  if (!run.current_node_id) {
    throw new Error('El workflow no tiene un nodo actual (current_node_id es null)');
  }

  // 2. Load graph + process
  const { nodes, edges } = await fetchGraph(run.template_id, supabase);
  const legalProcess = await fetchLegalProcess(run.legal_process_id, supabase);
  const clientData = await fetchClientData(run.legal_process_id, supabase);

  // 3. Close the currently-open step_run (the one that was waiting)
  await db
    .from('workflow_step_runs')
    .update({
      status: 'completed',
      output: input,
      executed_at: new Date().toISOString(),
    })
    .eq('workflow_run_id', workflowRunId)
    .eq('node_id', run.current_node_id)
    .eq('status', 'running');

  // Audit: workflow resumed
  void db.from('audit_logs').insert({
    organization_id: legalProcess.organization_id,
    user_id: legalProcess.lawyer_id,
    action: 'workflow_resumed',
    entity: 'legal_process',
    entity_id: run.legal_process_id,
    metadata: {
      workflow_run_id: workflowRunId,
      resumed_from_node: run.current_node_id,
    },
  });

  // 4. Find the waiting node from step_runs (robust against fan-out races)
  const { data: waitingStep } = await db
    .from('workflow_step_runs')
    .select('node_id')
    .eq('workflow_run_id', workflowRunId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { node_id: string } | null };

  const resumeFromNodeId = waitingStep?.node_id ?? run.current_node_id;
  if (!resumeFromNodeId) throw new Error('No se encontró nodo en espera para reanudar');

  // 5. Resolve the next nodes from the waiting node's outgoing edges
  const context: ExecutionContext = {
    workflowRun: run,
    legalProcess,
    previousOutput: input,
    clientData,
  };

  const nextNodeIds = getNextNodes(edges, resumeFromNodeId, context);

  if (nextNodeIds.length === 0) {
    await markRunCompleted(run.id, supabase);
    return;
  }

  const nextNodes = nextNodeIds
    .map((id) => nodes.find((n) => n.node_id === id))
    .filter((n): n is WorkflowNodeRow => !!n);

  await Promise.all(nextNodes.map((n) => runFromNode(n, nodes, edges, context, supabase, 0)));
}

// -----------------------------------------------------------------------------

/**
 * Re-executes a generate_document node that was waiting for the lawyer to select
 * document templates at runtime. Deletes the waiting step_run and re-runs the node
 * with the selected template IDs injected into previousOutput.
 */
export async function executeDocumentWithTemplates(
  workflowRunId: string,
  templateIds: string[],
): Promise<void> {
  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  const { data: run, error: runErr } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', workflowRunId)
    .single() as { data: WorkflowRunRow | null; error: { message: string } | null };

  if (runErr || !run) throw new Error(runErr?.message ?? 'workflow_run no encontrado');
  if (run.status !== 'running') {
    throw new Error(`No se puede continuar un workflow con estado "${run.status}"`);
  }
  if (!run.current_node_id) {
    throw new Error('El workflow no tiene un nodo actual');
  }

  // Remove the waiting step_run so it can be re-created on execution
  await db
    .from('workflow_step_runs')
    .delete()
    .eq('workflow_run_id', workflowRunId)
    .eq('node_id', run.current_node_id)
    .eq('status', 'running');

  const { nodes, edges } = await fetchGraph(run.template_id, supabase);
  const legalProcess = await fetchLegalProcess(run.legal_process_id, supabase);
  const clientData = await fetchClientData(run.legal_process_id, supabase);

  const currentNode = nodes.find((n) => n.node_id === run.current_node_id);
  if (!currentNode) throw new Error(`Nodo "${run.current_node_id}" no encontrado en el template`);

  const context: ExecutionContext = {
    workflowRun: run,
    legalProcess,
    previousOutput: { template_ids: templateIds },
    clientData,
  };

  await runFromNode(currentNode, nodes, edges, context, supabase, 0);
}

export async function executeEmailWithAttachments(
  workflowRunId: string,
  documentIds: string[],
): Promise<void> {
  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  const { data: run, error: runErr } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', workflowRunId)
    .single() as { data: WorkflowRunRow | null; error: { message: string } | null };

  if (runErr || !run) throw new Error(runErr?.message ?? 'workflow_run no encontrado');
  if (run.status !== 'running') {
    throw new Error(`No se puede continuar un workflow con estado "${run.status}"`);
  }
  if (!run.current_node_id) {
    throw new Error('El workflow no tiene un nodo actual');
  }

  // Fan-out safe: current_node_id may point to the completed branch (e.g. notify_lawyer)
  // rather than the send_email node that is still waiting. Fetch the graph and all
  // running step_runs to find the correct send_email node.
  const { nodes, edges } = await fetchGraph(run.template_id, supabase);

  const { data: runningSteps } = await db
    .from('workflow_step_runs')
    .select('node_id')
    .eq('workflow_run_id', workflowRunId)
    .eq('status', 'running') as { data: { node_id: string }[] | null };

  const waitingNodeId =
    runningSteps
      ?.map((s) => s.node_id)
      .find((nid) => nodes.find((n) => n.node_id === nid)?.type === 'send_email')
    ?? run.current_node_id;

  await db
    .from('workflow_step_runs')
    .delete()
    .eq('workflow_run_id', workflowRunId)
    .eq('node_id', waitingNodeId)
    .eq('status', 'running');

  const legalProcess = await fetchLegalProcess(run.legal_process_id, supabase);
  const clientData = await fetchClientData(run.legal_process_id, supabase);

  const currentNode = nodes.find((n) => n.node_id === waitingNodeId);
  if (!currentNode) throw new Error(`Nodo "${waitingNodeId}" no encontrado en el template`);

  const context: ExecutionContext = {
    workflowRun: run,
    legalProcess,
    previousOutput: { selected_document_ids: documentIds },
    clientData,
  };

  await runFromNode(currentNode, nodes, edges, context, supabase, 0);
}

// -----------------------------------------------------------------------------

export async function cancelWorkflow(workflowRunId: string): Promise<void> {
  const supabase = await createClient({ admin: true });

  await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('workflow_runs')
    .update({ status: 'cancelled' })
    .eq('id', workflowRunId);
}

// -----------------------------------------------------------------------------

/**
 * Retries a failed workflow run from its current node.
 *
 * Resets the run status back to 'running' and re-executes from current_node_id.
 * Use this to recover workflows stuck in 'failed' state (e.g. after a transient
 * error or after fixing a misconfiguration like missing template_ids).
 */
export async function retryWorkflow(workflowRunId: string): Promise<void> {
  const supabase = await createClient({ admin: true });
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  const { data: run, error: runErr } = await db
    .from('workflow_runs')
    .select('*')
    .eq('id', workflowRunId)
    .single() as { data: WorkflowRunRow | null; error: { message: string } | null };

  if (runErr || !run) throw new Error(runErr?.message ?? 'workflow_run no encontrado');
  if (run.status !== 'failed') {
    throw new Error(`Solo se pueden reintentar workflows en estado "failed" (actual: "${run.status}")`);
  }
  if (!run.current_node_id) {
    throw new Error('El workflow no tiene nodo actual para reintentar');
  }

  // Reset the run to 'running'
  await db
    .from('workflow_runs')
    .update({ status: 'running' })
    .eq('id', workflowRunId);

  // Delete the failed step_run for the current node so it can be re-inserted
  await db
    .from('workflow_step_runs')
    .delete()
    .eq('workflow_run_id', workflowRunId)
    .eq('node_id', run.current_node_id)
    .eq('status', 'failed');

  const { nodes, edges } = await fetchGraph(run.template_id, supabase);
  const legalProcess = await fetchLegalProcess(run.legal_process_id, supabase);
  const clientData = await fetchClientData(run.legal_process_id, supabase);

  // Audit: workflow retried (legalProcess now available)
  void db.from('audit_logs').insert({
    organization_id: legalProcess.organization_id,
    user_id: legalProcess.lawyer_id,
    action: 'workflow_retried',
    entity: 'legal_process',
    entity_id: run.legal_process_id,
    metadata: {
      workflow_run_id: workflowRunId,
      retried_from_node: run.current_node_id,
      source: 'system',
    },
  });

  const currentNode = nodes.find((n) => n.node_id === run.current_node_id);
  if (!currentNode) throw new Error(`Nodo "${run.current_node_id}" no encontrado en el template`);

  const context: ExecutionContext = {
    workflowRun: run,
    legalProcess,
    previousOutput: {},
    clientData,
  };

  await runFromNode(currentNode, nodes, edges, context, supabase, 0);
}

// =============================================================================
// Internal execution loop
// =============================================================================

async function runFromNode(
  node: WorkflowNodeRow,
  allNodes: WorkflowNodeRow[],
  allEdges: WorkflowEdgeRow[],
  context: ExecutionContext,
  supabase: SupabaseClient,
  stepCount: number,
): Promise<void> {
  if (stepCount >= MAX_STEPS) {
    await failRun(context.workflowRun.id, `Límite de ${MAX_STEPS} pasos alcanzado`, supabase);
    return;
  }

  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  // ── 1. Stamp the run with the current node ──────────────────────────────────
  await db
    .from('workflow_runs')
    .update({ current_node_id: node.node_id })
    .eq('id', context.workflowRun.id);

  // ── 2. Open a step_run record ───────────────────────────────────────────────
  const { data: stepRun, error: stepErr } = await db
    .from('workflow_step_runs')
    .insert({
      workflow_run_id: context.workflowRun.id,
      node_id: node.node_id,
      status: 'running',
      input: context.previousOutput,
      output: {},
    })
    .select('id')
    .single() as { data: Pick<WorkflowStepRunRow, 'id'> | null; error: { message: string } | null };

  if (stepErr || !stepRun) {
    await failRun(context.workflowRun.id, stepErr?.message ?? 'Error al crear step_run', supabase);
    return;
  }

  // ── 3. Execute the node ─────────────────────────────────────────────────────
  let result;
  try {
    result = await executeNode(node, context, supabase);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    void db.from('audit_logs').insert({
      organization_id: context.legalProcess.organization_id,
      user_id: context.legalProcess.lawyer_id,
      action: 'workflow_failed',
      entity: 'legal_process',
      entity_id: context.legalProcess.id,
      metadata: {
        workflow_run_id: context.workflowRun.id,
        node_id: node.node_id,
        node_title: node.title,
        error: message,
      },
    });
    await failStep(stepRun.id, context.workflowRun.id, message, supabase);
    return;
  }

  // ── 4. Persist step result ──────────────────────────────────────────────────
  //    'waiting' steps stay in status=running; they'll be closed by resumeWorkflow.
  const stepStatus =
    result.status === 'waiting' ? 'running' :
      result.status === 'failed' ? 'failed' :
    /* completed */               'completed';

  await db
    .from('workflow_step_runs')
    .update({
      status: stepStatus,
      output: result.output,
      executed_at: result.status !== 'waiting' ? new Date().toISOString() : null,
    })
    .eq('id', stepRun.id);

  // ── 5. Route based on result ────────────────────────────────────────────────

  if (result.status === 'waiting') {
    // Execution paused — stay on this node until resumeWorkflow is called
    return;
  }

  if (result.status === 'failed') {
    void db.from('audit_logs').insert({
      organization_id: context.legalProcess.organization_id,
      user_id: context.legalProcess.lawyer_id,
      action: 'workflow_failed',
      entity: 'legal_process',
      entity_id: context.legalProcess.id,
      metadata: {
        workflow_run_id: context.workflowRun.id,
        node_id: node.node_id,
        node_title: node.title,
        error: result.error,
      },
    });
    await failRun(context.workflowRun.id, result.error ?? 'Error en nodo', supabase);
    return;
  }

  // result.status === 'completed'
  const updatedContext: ExecutionContext = {
    ...context,
    previousOutput: result.output,
  };

  const nextNodeIds = getNextNodes(allEdges, node.node_id, updatedContext);

  if (nextNodeIds.length === 0) {
    // This branch has no more nodes to execute.
    // In a fan-out workflow other branches may still be running or waiting,
    // so only mark the run as completed when ALL step_runs are done.
    const { count: runningCount } = await (db
      .from('workflow_step_runs')
      .select('id', { count: 'exact', head: true })
      .eq('workflow_run_id', context.workflowRun.id)
      .eq('status', 'running') as unknown as Promise<{ count: number | null }>);

    if ((runningCount ?? 0) === 0) {
      void db.from('audit_logs').insert({
        organization_id: context.legalProcess.organization_id,
        user_id: context.legalProcess.lawyer_id,
        action: 'workflow_completed',
        entity: 'legal_process',
        entity_id: context.legalProcess.id,
        metadata: { workflow_run_id: context.workflowRun.id },
      });
      await markRunCompleted(context.workflowRun.id, supabase);
    }
    // else: other branches still active — do not close the run yet
    return;
  }

  const nextNodes = nextNodeIds
    .map((id) => allNodes.find((n) => n.node_id === id))
    .filter((n): n is WorkflowNodeRow => !!n);

  const missingIds = nextNodeIds.filter((id) => !allNodes.find((n) => n.node_id === id));
  if (missingIds.length > 0) {
    await failRun(
      context.workflowRun.id,
      `Nodos siguientes no encontrados: ${missingIds.join(', ')}`,
      supabase,
    );
    return;
  }

  if (nextNodes.length === 1) {
    // Single path — tail-recurse (original behavior)
    await runFromNode(nextNodes[0], allNodes, allEdges, updatedContext, supabase, stepCount + 1);
  } else {
    // Fan-out — run all branches in parallel
    await Promise.all(
      nextNodes.map((n) => runFromNode(n, allNodes, allEdges, updatedContext, supabase, stepCount + 1)),
    );
  }
}

// =============================================================================
// Database helpers
// =============================================================================

async function fetchGraph(
  templateId: string,
  supabase: SupabaseClient,
): Promise<{ nodes: WorkflowNodeRow[]; edges: WorkflowEdgeRow[] }> {
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  const [
    { data: nodes, error: nodesErr },
    { data: edges, error: edgesErr },
  ] = await Promise.all([
    db.from('workflow_nodes').select('*').eq('template_id', templateId) as unknown as Promise<{
      data: WorkflowNodeRow[] | null;
      error: { message: string } | null;
    }>,
    db.from('workflow_edges').select('*').eq('template_id', templateId) as unknown as Promise<{
      data: WorkflowEdgeRow[] | null;
      error: { message: string } | null;
    }>,
  ]);

  if (nodesErr) throw new Error(nodesErr.message);
  if (edgesErr) throw new Error(edgesErr.message);

  return { nodes: nodes ?? [], edges: edges ?? [] };
}

async function fetchLegalProcess(
  legalProcessId: string,
  supabase: SupabaseClient,
): Promise<LegalProcessRow> {
  const { data, error } = await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('legal_processes')
    .select('id, organization_id, lawyer_id, email, status, workflow_run_id, document_type, document_number, access_token')
    .eq('id', legalProcessId)
    .single() as { data: LegalProcessRow | null; error: { message: string } | null };

  if (error || !data) throw new Error(error?.message ?? 'Proceso legal no encontrado');

  if (data.access_token) {
    data.form_url = `${process.env.NEXT_PUBLIC_APP_URL}/legal-process/validate-token?token=${data.access_token}`;
  }

  return data;
}

/**
 * Loads flattened client data (personal info from legal_process_clients)
 * for use in variable substitution. Returns an empty object if no client
 * record exists yet (e.g. the form hasn't been submitted).
 */
async function fetchClientData(
  legalProcessId: string,
  supabase: SupabaseClient,
): Promise<Record<string, unknown>> {
  const { data } = await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('legal_process_clients')
    .select('first_name, last_name, address, document_number, document_slug, document_name, email, phone')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle() as { data: Record<string, unknown> | null };

  return data ?? {};
}

async function markRunCompleted(runId: string, supabase: SupabaseClient): Promise<void> {
  await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('workflow_runs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', runId);
}

async function failRun(runId: string, reason: string, supabase: SupabaseClient): Promise<void> {
  await (supabase as unknown as Record<string, unknown> & SupabaseClient)
    .from('workflow_runs')
    .update({ status: 'failed' })
    .eq('id', runId);

  // Log the failure reason for debugging
  console.error(`[WorkflowRunner] Run ${runId} failed: ${reason}`);
}

async function failStep(
  stepRunId: string,
  runId: string,
  message: string,
  supabase: SupabaseClient,
): Promise<void> {
  const db = supabase as unknown as Record<string, unknown> & SupabaseClient;

  await Promise.all([
    db
      .from('workflow_step_runs')
      .update({ status: 'failed', output: { error: message }, executed_at: new Date().toISOString() })
      .eq('id', stepRunId),
    failRun(runId, message, supabase),
  ]);
}
