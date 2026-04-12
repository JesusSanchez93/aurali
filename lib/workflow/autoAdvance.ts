/**
 * autoAdvance.ts
 *
 * Status-driven workflow auto-advancement.
 *
 * When the legal process status changes — either through the workflow runner
 * (status_update node) or via an external action (manual status change from
 * the UI) — this module decides whether the workflow should automatically
 * advance to the next step.
 *
 * Rules:
 *   - manual_action nodes  → can be auto-completed by a qualifying status change
 *   - client_form nodes    → NEVER auto-advance (client must submit the form)
 *   - All instant nodes    → already chained automatically by the workflow runner
 *
 * The function is safe to call from the workflow runner itself because it is
 * a no-op when invoked from within an already-running execution chain
 * (the workflow_run status will be 'running' but the step won't be in a
 * blocking state we need to unstick).
 */

import { createClient } from '@/lib/supabase/server';
import { resumeWorkflow } from './workflowRunner';
import { buildDocumentTemplateData } from './nodeExecutors';
import { generateDocument } from '@/lib/documents/generateDocument';
import type { LegalProcessStatus } from './types';

// ─── Configuration ─────────────────────────────────────────────────────────────

/**
 * Statuses that represent a deliberate human decision that should automatically
 * advance the workflow past a pending manual_action node.
 *
 * When an external action sets the process to one of these statuses, the system
 * resumes the workflow so all subsequent instant nodes (generate_document,
 * send_email, status_update, etc.) run without requiring an additional button click.
 *
 * NOT included: draft, form_sent, completed — these either start the flow
 * or wait for client input (client_form), so auto-advance doesn't apply.
 */
const STATUSES_THAT_AUTO_ADVANCE: ReadonlySet<LegalProcessStatus> = new Set([
  'approved',            // Lawyer approved client data → generate documents
  'documents_approved',  // Lawyer approved generated docs → send to client
  'paid',                // Payment confirmed → mark finished
  'finished',            // Process manually finalized
]);

// ─── Public API ────────────────────────────────────────────────────────────────

export type AutoAdvanceResult =
  | { advanced: true }
  | { advanced: false; reason: 'no_workflow' | 'not_running' | 'waiting_for_client' | 'status_not_actionable' | 'no_blocking_node' };

/**
 * Attempts to auto-advance the workflow after an external status change.
 *
 * Intended to be called AFTER the legal_processes.status has already been
 * updated in the database. The function:
 *   1. Finds the running workflow for the process.
 *   2. Checks the current blocking node type.
 *   3. If it's a manual_action AND newStatus is in STATUSES_THAT_AUTO_ADVANCE,
 *      marks the step complete and resumes the workflow chain.
 *   4. Otherwise returns without doing anything.
 *
 * @param legalProcessId  UUID of the legal process whose status just changed.
 * @param newStatus       The status the process was just set to.
 */
export async function autoAdvanceWorkflow(
  legalProcessId: string,
  newStatus: string,
): Promise<AutoAdvanceResult> {
  // Only act on statuses that represent a deliberate approval decision
  if (!STATUSES_THAT_AUTO_ADVANCE.has(newStatus as LegalProcessStatus)) {
    return { advanced: false, reason: 'status_not_actionable' };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── 1. Find the running workflow ─────────────────────────────────────────
  const { data: lp } = await db
    .from('legal_processes')
    .select('workflow_run_id')
    .eq('id', legalProcessId)
    .single() as { data: { workflow_run_id: string | null } | null };

  if (!lp?.workflow_run_id) {
    return { advanced: false, reason: 'no_workflow' };
  }

  const { data: run } = await db
    .from('workflow_runs')
    .select('id, template_id, current_node_id, status')
    .eq('id', lp.workflow_run_id)
    .single() as {
      data: {
        id: string;
        template_id: string;
        current_node_id: string | null;
        status: string;
      } | null;
    };

  if (!run || run.status !== 'running' || !run.current_node_id) {
    return { advanced: false, reason: 'not_running' };
  }

  // ── 2. Check the current blocking node type ──────────────────────────────
  const { data: node } = await db
    .from('workflow_nodes')
    .select('type, title, config')
    .eq('template_id', run.template_id)
    .eq('node_id', run.current_node_id)
    .single() as { data: { type: string; title: string; config: Record<string, unknown> } | null };

  if (!node) {
    return { advanced: false, reason: 'no_blocking_node' };
  }

  // client_form: the client must submit — never auto-advance
  if (node.type === 'client_form') {
    return { advanced: false, reason: 'waiting_for_client' };
  }

  // manual_action: can be completed by a qualifying status change
  if (node.type === 'manual_action') {
    await resumeWorkflow(run.id, {
      auto_advanced: true,
      triggered_by_status: newStatus,
      advanced_at: new Date().toISOString(),
    });
    return { advanced: true };
  }

  // generate_document in preview mode: generate actual PDFs now
  if (node.type === 'generate_document') {
    const cfg = node.config as { preview?: boolean; template_ids?: string[]; template_id?: string };
    if (!cfg.preview) return { advanced: false, reason: 'no_blocking_node' };

    const ids = cfg.template_ids && cfg.template_ids.length > 0
      ? cfg.template_ids
      : cfg.template_id ? [cfg.template_id] : [];

    if (ids.length === 0) {
      // No pre-configured templates — runtime selection required via WorkflowActionButton
      return { advanced: false, reason: 'no_blocking_node' };
    }

    try {
      const { templateData, organizationId } = await buildDocumentTemplateData(legalProcessId, supabase);

      type GenDoc = { document_id: string; document_name: string; file_url: string; storage_path: string; template_id: string };
      const documents: GenDoc[] = [];

      for (const tid of ids) {
        const result = await generateDocument({
          templateId:     tid,
          data:           templateData,
          legalProcessId,
          organizationId: organizationId ?? undefined,
        });
        documents.push({
          document_id:   result.documentId   ?? '',
          document_name: result.fileName     ?? '',
          file_url:      result.fileUrl      ?? '',
          storage_path:  result.storagePath  ?? '',
          template_id:   tid,
        });
      }

      // Remove preview records — final PDFs are now stored
      await db.from('generated_documents')
        .delete()
        .eq('legal_process_id', legalProcessId)
        .eq('is_preview', true);

      const first = documents[0];
      await resumeWorkflow(run.id, {
        documents,
        document_id:   first?.document_id   ?? '',
        document_name: first?.document_name ?? '',
        file_url:      first?.file_url      ?? '',
        storage_path:  first?.storage_path  ?? '',
      });
    } catch (err) {
      console.error('[autoAdvance] Error generating PDFs from preview:', err);
    }
    return { advanced: true };
  }

  // Any other node type at "blocking" position is unexpected; skip.
  return { advanced: false, reason: 'no_blocking_node' };
}
