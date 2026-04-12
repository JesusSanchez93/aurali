'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { startWorkflow, resumeWorkflow, retryWorkflow, executeDocumentWithTemplates, executeEmailWithAttachments } from '@/lib/workflow/workflowRunner';
import { autoAdvanceWorkflow } from '@/lib/workflow/autoAdvance';
import { buildDocumentTemplateData } from '@/lib/workflow/nodeExecutors';
import { tiptapJsonToBodyHtml } from '@/lib/documents/tiptapServer';
import { substituteVars, wrapWithPageLayout, renderHeaderFooterHtml } from '@/lib/documents/htmlRenderer';

type LocalizedString = {
  es?: string;
  en?: string;
};

function revalidateLegalProcessPaths() {
  revalidatePath('/legal-process');
  revalidatePath('/es/legal-process');
  revalidatePath('/en/legal-process');
}

export async function getLegalProcesses(page: number = 1, pageSize: number = 10, search?: string, status?: string | string[]) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id)
    throw new Error('Organization not found');

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('legal_processes')
    .select('*, legal_process_clients!inner (*)', { count: 'exact' })
    .eq('organization_id', profile.current_organization_id);


  if (search) {
    // Strip leading "#" if present, then check if the remainder is purely numeric.
    // Both "#0003" and "0003" and "3" are treated as consecutive-number lookups.
    const rawSearch = search.startsWith('#') ? search.slice(1) : search;
    const isNumeric = /^\d+$/.test(rawSearch.trim());

    if (isNumeric) {
      const processNum = parseInt(rawSearch.trim(), 10);
      query = Number.isFinite(processNum)
        ? query.eq('process_number', processNum)
        : query.eq('process_number', -1);
    } else {
      // Text search on client fields (joined table)
      query = query.or(
        `legal_process_clients.first_name.ilike.%${search}%,` +
        `legal_process_clients.last_name.ilike.%${search}%,` +
        `legal_process_clients.email.ilike.%${search}%,` +
        `legal_process_clients.document_number.ilike.%${search}%`,
      );
    }
  }

  if (status) {
    const statuses = Array.isArray(status)
      ? status
      : status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('status', statuses);
    }
  }

  const { data: legalProcesses, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[legal-process/getLegalProcesses] query failed', {
      page,
      pageSize,
      search: search ?? null,
      status: status ?? null,
      organizationId: profile.current_organization_id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error('No se pudieron cargar los procesos legales');
  }

  const mappedProcesses = legalProcesses?.map(({ legal_process_clients, ...e }) => ({
    ...e,
    client: legal_process_clients[0] || null
  })) || [];

  return { processes: mappedProcesses, count: count || 0 };
}

export async function getDocuments() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id)
    throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('documents')
    .select('id, name, slug')
    .eq('organization_id', profile?.current_organization_id);

  if (error) {
    console.error('[legal-process/getDocuments] query failed', {
      organizationId: profile.current_organization_id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error('No se pudieron cargar los documentos');
  }

  return (data || [])?.map((e) => ({
    ...e,
    name: e.name as LocalizedString | null,
  }));
}

export async function   getOrgLawyers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) return [];

  const { data, error } = await (supabase as any)
    .from('organization_members')
    .select('user_id, profiles!user_id(id, firstname, lastname, email)')
    .eq('organization_id', profile.current_organization_id)
    .eq('active', true);

  if (error) console.error('getOrgLawyers error:', error);
    

  return (data ?? []).map((m: { user_id: string; profiles: { id: string; firstname: string | null; lastname: string | null; email: string | null } }) => ({
    id: m.profiles?.id ?? m.user_id,
    firstname: m.profiles?.firstname ?? null,
    lastname: m.profiles?.lastname ?? null,
    email: m.profiles?.email ?? null,
  }));
}

export async function createLegalProcessDraft(values: {
  document_id: string;
  document_slug: string;
  document_type: string;
  document_number: string;
  email: string;
  assigned_to: string;
}): Promise<{ id: string }> {
  const traceId = randomUUID();
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_organization_id) {
      throw new Error('Organization not found');
    }

    const organizationId = profile.current_organization_id;

  // Look up existing client scoped to this org to avoid cross-org matches
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', values.email)
      .eq('organization_id', organizationId)
      .maybeSingle();

    let clientId = client?.id;

    if (!client) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          status: 'draft',
          document_id: values.document_id,
          document_number: values.document_number,
          email: values.email,
          created_by: user.id,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) {
        // Unique constraint violation: another request created the client concurrently — re-fetch
        if (error.code === '23505') {
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('email', values.email)
            .eq('organization_id', organizationId)
            .single();
          clientId = existingClient?.id;
        } else {
          console.error(error);
          throw new Error(error.message);
        }
      } else {
        clientId = newClient.id;
      }
    }

    const publicToken = randomUUID();

    const { data: newLegalProcess, error: legalProcessError } = await supabase
      .from('legal_processes')
      // process_number is assigned by a DB trigger — not provided here
      .insert({
        status: 'draft',
        organization_id: organizationId,
        lawyer_id: values.assigned_to,
        assigned_to: values.assigned_to,
        access_token: publicToken,
        access_token_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 72 hours
        created_by: user.id,
      } as never)
      .select()
      .single();

    if (legalProcessError) {
      throw new Error(legalProcessError.message);
    }

    if (newLegalProcess?.id) {
      const { error: errorLegalProcessClients } = await supabase
        .from('legal_process_clients')
        .insert({
          legal_process_id: newLegalProcess.id,
          organization_id: organizationId,
          document_id: values.document_id,
          document_slug: values.document_slug,
          document_number: values.document_number,
          client_id: clientId,
          email: values.email,
          created_by: user.id,
        });

      if (errorLegalProcessClients) {
        // Rollback: remove the legal_process to avoid orphan record
        await supabase.from('legal_processes').delete().eq('id', newLegalProcess.id);
        throw new Error(errorLegalProcessClients.message);
      }

      const { error: errorLegalProcessBanks } = await supabase
        .from('legal_process_banks')
        .insert({
          legal_process_id: newLegalProcess.id,
          organization_id: organizationId,
          created_by: user.id,
        });

      if (errorLegalProcessBanks) {
        // Rollback: cascade delete will also remove legal_process_clients
        await supabase.from('legal_processes').delete().eq('id', newLegalProcess.id);
        throw new Error(errorLegalProcessBanks.message);
      }
    }
    // Get the active workflow template for this org
    const { data: orgWorkflow } = await supabase
      .from('organization_workflows')
      .select('workflow_template_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (!orgWorkflow?.workflow_template_id) {
      throw new Error('La organización no tiene un flujo de trabajo activo asignado');
    }

  // Start the workflow — it will send the invitation email automatically
  // via the send_email node configured with email_template: 'client_form_email'
    await startWorkflow(orgWorkflow.workflow_template_id, newLegalProcess.id);

  // Audit: process created
    void supabase.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: user.id,
      action: 'process_created',
      entity: 'legal_process',
      entity_id: newLegalProcess.id,
      metadata: {
        document_slug: values.document_slug,
        assigned_to: values.assigned_to,
        client_email: values.email,
        trace_id: traceId,
      },
    });

    revalidateLegalProcessPaths();
    return { id: newLegalProcess.id };
  } catch (error) {
    const e = error as Error & { digest?: string };
    console.error('[legal-process/createLegalProcessDraft] failed', {
      traceId,
      documentId: values.document_id,
      documentSlug: values.document_slug,
      assignedTo: values.assigned_to,
      email: values.email,
      message: e?.message ?? String(error),
      digest: e?.digest ?? null,
      stack: e?.stack ?? null,
    });
    throw error;
  }
}

export async function getLegalProcessDetail(legalProcessId: string) {
  const supabase = await createClient();

  const { data: legalProcess, error: processError } = await supabase
    .from('legal_processes')
    .select('*')
    .eq('id', legalProcessId)
    .single();

  if (processError || !legalProcess) {
    throw new Error('Proceso legal no encontrado');
  }

  const { data: clientData } = await supabase
    .from('legal_process_clients')
    .select('*')
    .eq('legal_process_id', legalProcessId)
    .single();

  if (clientData) {
    if (clientData.document_front_image && !clientData.document_front_image.startsWith('http')) {
      const { data: frontData } = await supabase.storage
        .from('documents')
        .createSignedUrl(clientData.document_front_image, 3600);
      if (frontData) clientData.document_front_image = frontData.signedUrl;
    }

    if (clientData.document_back_image && !clientData.document_back_image.startsWith('http')) {
      const { data: backData } = await supabase.storage
        .from('documents')
        .createSignedUrl(clientData.document_back_image, 3600);
      if (backData) clientData.document_back_image = backData.signedUrl;
    }
  }

  const { data: bankingData } = await supabase
    .from('legal_process_banks')
    .select('*')
    .eq('legal_process_id', legalProcessId)
    .single();

  const [{ data: feeData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('legal_process_fees')
      .select('id, total_amount, currency, notes')
      .eq('legal_process_id', legalProcessId)
      .maybeSingle(),
    supabase
      .from('legal_process_payments')
      .select('id, amount, payment_method, payment_date, reference, notes, created_at')
      .eq('legal_process_id', legalProcessId)
      .order('payment_date', { ascending: true }),
  ]);

  return {
    process: legalProcess,
    client: clientData ?? null,
    banking: bankingData ?? null,
    fee: feeData ?? null,
    payments: (paymentsData ?? []) as { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string }[],
  };
}

/**
 * Called when the lawyer confirms payment received.
 * Resumes the workflow from the manual_action node, which continues:
 * status_update(paid) → generate_document → send_documents → status_update(documents_sent)
 */
export async function markLegalProcessAsPaid(legalProcessId: string) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: process } = await supabase
    .from('legal_processes')
    .select('workflow_run_id, status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!process?.workflow_run_id) {
    throw new Error('Este proceso no tiene un flujo de trabajo asociado');
  }

  if (process.status !== 'completed') {
    throw new Error('El proceso debe estar en estado "completado" para marcar el pago');
  }

  await resumeWorkflow(process.workflow_run_id, { paid_at: new Date().toISOString() });

  void supabase.from('audit_logs').insert({
    organization_id: process.organization_id,
    user_id: user.id,
    action: 'payment_confirmed',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { workflow_run_id: process.workflow_run_id, source: 'manual' },
  });

  revalidatePath('/legal-process');
}

export async function updateLegalProcessStatus(legalProcessId: string, newStatus: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { data: process } = await supabase
    .from('legal_processes')
    .select('status, organization_id')
    .eq('id', legalProcessId)
    .single();

  const { error } = await supabase
    .from('legal_processes')
    .update({ status: newStatus })
    .eq('id', legalProcessId);

  if (error) {
    throw new Error(error.message);
  }

  void supabase.from('audit_logs').insert({
    organization_id: process?.organization_id,
    user_id: user.id,
    action: 'status_change',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: {
      previous_status: process?.status,
      new_status: newStatus,
      source: 'manual',
    },
  });

  // Auto-advance the workflow if this status change implies a manual approval
  void autoAdvanceWorkflow(legalProcessId, newStatus);

  revalidatePath('/legal-process');
}

/** Statuses that block archiving */
const ARCHIVE_BLOCKED_STATUSES = new Set(['finished', 'archived', 'declined']);
/** Statuses that block declining */
const DECLINE_BLOCKED_STATUSES = new Set(['finished', 'declined']);

/**
 * Archives a legal process. Can be called at any point before 'finished'.
 * Saves current status to previous_status so the action can be reverted.
 */
export async function archiveLegalProcess(legalProcessId: string, note?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: process } = await supabase
    .from('legal_processes')
    .select('status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!process) throw new Error('Proceso no encontrado');
  if (ARCHIVE_BLOCKED_STATUSES.has(process.status ?? '')) {
    throw new Error('Este proceso ya está en un estado que no permite archivarlo');
  }

  const { error } = await (supabase as any)
    .from('legal_processes')
    .update({ status: 'archived', previous_status: process.status, status_note: note ?? null })
    .eq('id', legalProcessId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_logs').insert({
    organization_id: process.organization_id,
    user_id: user.id,
    action: 'status_change',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { previous_status: process.status, new_status: 'archived', source: 'manual', note: note || null },
  });

  revalidatePath('/legal-process');
}

/**
 * Reverts an archived process back to the status it had before being archived.
 */
export async function revertArchivedProcess(legalProcessId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: process } = await (supabase as any)
    .from('legal_processes')
    .select('status, previous_status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!process) throw new Error('Proceso no encontrado');
  if (process.status !== 'archived') {
    throw new Error('Solo se pueden revertir procesos en estado archivado');
  }

  const restoredStatus = process.previous_status ?? 'draft';

  const { error } = await (supabase as any)
    .from('legal_processes')
    .update({ status: restoredStatus, previous_status: null, status_note: null })
    .eq('id', legalProcessId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_logs').insert({
    organization_id: process.organization_id,
    user_id: user.id,
    action: 'status_change',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: {
      previous_status: 'archived',
      new_status: restoredStatus,
      source: 'manual',
      reverted: true,
    },
  });

  revalidatePath('/legal-process');
}

/**
 * Declines a legal process. Can be called at any point before 'finished'.
 * Does NOT cancel the workflow run; the process simply becomes read-only.
 */
export async function declineLegalProcess(legalProcessId: string, note?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: process } = await supabase
    .from('legal_processes')
    .select('status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!process) throw new Error('Proceso no encontrado');
  if (DECLINE_BLOCKED_STATUSES.has(process.status ?? '')) {
    throw new Error('Este proceso ya está en un estado que no permite declinarlo');
  }

  const { error } = await supabase
    .from('legal_processes')
    .update({ status: 'declined', status_note: note ?? null } as never)
    .eq('id', legalProcessId);

  if (error) throw new Error(error.message);

  await supabase.from('audit_logs').insert({
    organization_id: process.organization_id,
    user_id: user.id,
    action: 'status_change',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { previous_status: process.status, new_status: 'declined', source: 'manual', note: note || null },
  });

  revalidatePath('/legal-process');
}

export type PendingWorkflowAction =
  | { kind: 'manual_action';                workflowRunId: string; nodeTitle: string; instructions: string | null }
  | { kind: 'failed';                       workflowRunId: string; nodeTitle: string; error: string | null }
  | { kind: 'document_preview';             workflowRunId: string; nodeTitle: string; previewCount: number }
  | { kind: 'template_selection';           workflowRunId: string; nodeTitle: string }
  | { kind: 'document_attachment_selection'; workflowRunId: string; nodeTitle: string; availableDocuments: { id: string; name: string }[] };

export async function getPendingManualAction(
  legalProcessId: string,
): Promise<PendingWorkflowAction | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) return null;

  const { data: run } = await (supabase as any)
    .from('workflow_runs')
    .select('id, template_id, current_node_id, status')
    .eq('id', lp.workflow_run_id)
    .single() as { data: { id: string; template_id: string; current_node_id: string | null; status: string } | null };

  if (!run || !run.current_node_id) return null;

  // ── Failed run: allow retry ─────────────────────────────────────────────────
  if (run.status === 'failed') {
    const { data: failedStep } = await (supabase as any)
      .from('workflow_step_runs')
      .select('output')
      .eq('workflow_run_id', run.id)
      .eq('node_id', run.current_node_id)
      .eq('status', 'failed')
      .maybeSingle() as { data: { output: Record<string, unknown> } | null };

    const { data: node } = await (supabase as any)
      .from('workflow_nodes')
      .select('title')
      .eq('template_id', run.template_id)
      .eq('node_id', run.current_node_id)
      .single() as { data: { title: string } | null };

    return {
      kind:          'failed',
      workflowRunId: run.id,
      nodeTitle:     node?.title ?? run.current_node_id,
      error:         (failedStep?.output?.error as string | null) ?? null,
    };
  }

  // ── Running: scan all active step_runs (handles fan-out branches) ────────────
  if (run.status !== 'running') return null;

  // Fetch ALL running step_runs — current_node_id alone is unreliable in fan-out
  // workflows where one branch may still be waiting while another has completed.
  const { data: runningSteps } = await (supabase as any)
    .from('workflow_step_runs')
    .select('node_id, output')
    .eq('workflow_run_id', run.id)
    .eq('status', 'running') as { data: { node_id: string; output: Record<string, unknown> }[] | null };

  if (!runningSteps || runningSteps.length === 0) return null;

  for (const step of runningSteps) {
    const stepOutput = (step.output ?? {}) as Record<string, unknown>;

    const { data: node } = await (supabase as any)
      .from('workflow_nodes')
      .select('title, config, type')
      .eq('template_id', run.template_id)
      .eq('node_id', step.node_id)
      .single();

    if (!node) continue;

    if (node.type === 'manual_action') {
      return {
        kind:          'manual_action',
        workflowRunId: run.id,
        nodeTitle:     node.title,
        instructions:  (node.config?.instructions as string | null) ?? null,
      };
    }

    if (node.type === 'send_email' && stepOutput.waitingFor === 'document_attachment_selection') {
      const { data: docs } = await (supabase as any)
        .from('generated_documents')
        .select('id, document_name')
        .eq('legal_process_id', legalProcessId)
        .eq('is_preview', false) as { data: { id: string; document_name: string }[] | null };

      return {
        kind:               'document_attachment_selection',
        workflowRunId:      run.id,
        nodeTitle:          node.title,
        availableDocuments: (docs ?? []).map((d) => ({ id: d.id, name: d.document_name ?? 'Documento sin nombre' })),
      };
    }

    if (node.type === 'generate_document') {
      if (stepOutput.waitingFor === 'template_selection') {
        return {
          kind:          'template_selection',
          workflowRunId: run.id,
          nodeTitle:     node.title,
        };
      }

      if ((node.config as { preview?: boolean }).preview === true) {
        const { count } = await (supabase as any)
          .from('generated_documents')
          .select('id', { count: 'exact', head: true })
          .eq('legal_process_id', legalProcessId)
          .eq('is_preview', true) as { count: number | null };

        return {
          kind:          'document_preview',
          workflowRunId: run.id,
          nodeTitle:     node.title,
          previewCount:  count ?? 0,
        };
      }
    }
  }

  return null;
}

export async function retryFailedWorkflow(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  await retryWorkflow(lp.workflow_run_id);

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'workflow_retried',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { workflow_run_id: lp.workflow_run_id, source: 'manual' },
  });

  revalidatePath('/legal-process');
}

export async function confirmDocumentTemplates(
  legalProcessId: string,
  templateIds: string[],
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  await executeDocumentWithTemplates(lp.workflow_run_id, templateIds);

  revalidatePath('/legal-process');
}

export async function confirmEmailAttachments(
  legalProcessId: string,
  documentIds: string[],
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  await executeEmailWithAttachments(lp.workflow_run_id, documentIds);

  revalidatePath('/legal-process');
}

export interface WorkflowStepEntry {
  id: string;
  node_id: string;
  node_title: string;
  node_type: string;
  status: string;
  created_at: string;
  executed_at: string | null;
  output: Record<string, unknown>;
}

/**
 * Returns all workflow_step_runs for the given legal process,
 * joined with workflow_nodes to get title and type.
 */
export async function getProcessWorkflowSteps(legalProcessId: string): Promise<WorkflowStepEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Get the workflow_run for this process
  const { data: run } = await (supabase as any)
    .from('workflow_runs')
    .select('id, template_id')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; template_id: string } | null };

  if (!run) return [];

  // Get all step runs for this workflow run
  const { data: steps, error } = await (supabase as any)
    .from('workflow_step_runs')
    .select('id, node_id, status, output, created_at, executed_at')
    .eq('workflow_run_id', run.id)
    .order('created_at', { ascending: true }) as {
      data: { id: string; node_id: string; status: string; output: Record<string, unknown>; created_at: string; executed_at: string | null }[] | null;
      error: { message: string } | null;
    };

  if (error || !steps || steps.length === 0) return [];

  // Load node metadata (title, type) for all nodes in this template
  const { data: nodes } = await (supabase as any)
    .from('workflow_nodes')
    .select('node_id, title, type')
    .eq('template_id', run.template_id) as {
      data: { node_id: string; title: string; type: string }[] | null;
    };

  const nodeMap = Object.fromEntries((nodes ?? []).map((n) => [n.node_id, n]));

  return steps.map((step) => {
    const node = nodeMap[step.node_id];
    return {
      id:          step.id,
      node_id:     step.node_id,
      node_title:  node?.title ?? step.node_id,
      node_type:   node?.type  ?? 'unknown',
      status:      step.status,
      created_at:  step.created_at,
      executed_at: step.executed_at,
      output:      step.output ?? {},
    };
  });
}

export async function getDocumentPreviews(legalProcessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data } = await (supabase as any)
    .from('generated_documents')
    .select('id, document_name, html_content, tiptap_content, created_at')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', true)
    .order('created_at', { ascending: true }) as {
      data: { id: string; document_name: string | null; html_content: string | null; tiptap_content: unknown; created_at: string }[] | null;
    };

  return data ?? [];
}

/**
 * Called when the lawyer approves the document previews in the UI.
 * Generates the final PDFs from the preview templates, deletes the previews,
 * and resumes the workflow — without requiring a status change.
 *
 * This replaces the previous approach of setting status='documents_approved'
 * (which is not a valid DB status and was causing a silent constraint failure).
 */
export async function approveDocumentPreviews(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  // ── 1. Get the running workflow run ──────────────────────────────────────
  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  const { data: run } = await db
    .from('workflow_runs')
    .select('id, template_id, current_node_id, status')
    .eq('id', lp.workflow_run_id)
    .single() as { data: { id: string; template_id: string; current_node_id: string; status: string } | null };

  if (!run || run.status !== 'running' || !run.current_node_id) {
    throw new Error('El flujo de trabajo no está en un estado válido para aprobar documentos');
  }

  // ── 2. Verify current node is generate_document(preview=true) ─────────────
  const { data: node } = await db
    .from('workflow_nodes')
    .select('type, config')
    .eq('template_id', run.template_id)
    .eq('node_id', run.current_node_id)
    .single() as { data: { type: string; config: Record<string, unknown> } | null };

  if (!node || node.type !== 'generate_document' || !(node.config as { preview?: boolean }).preview) {
    throw new Error('El flujo no está esperando aprobación de documentos');
  }

  // ── 3. Generate final PDFs (using lawyer-edited preview content when available) ──
  const { buildDocumentTemplateData } = await import('@/lib/workflow/nodeExecutors');
  const { generateDocument } = await import('@/lib/documents/generateDocument');
  const { templateData, organizationId } = await buildDocumentTemplateData(legalProcessId, supabase);

  // Fetch preview records — these contain the selected template IDs AND any edits
  const { data: previewDocs } = await db
    .from('generated_documents')
    .select('template_id, tiptap_content')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', true) as {
      data: { template_id: string; tiptap_content: unknown }[] | null;
    };

  for (const preview of previewDocs ?? []) {
    await generateDocument({
      templateId:          preview.template_id,
      data:                templateData,
      legalProcessId,
      organizationId:      organizationId ?? undefined,
      editedTiptapContent: preview.tiptap_content,
    });
  }

  // ── 4. Remove preview records ─────────────────────────────────────────────
  await db.from('generated_documents')
    .delete()
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', true);

  // ── 5. Resume workflow ────────────────────────────────────────────────────
  await resumeWorkflow(run.id, {
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  });

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'documents_approved',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { workflow_run_id: run.id, templates_generated: previewDocs?.length ?? 0 },
  });

  revalidatePath('/legal-process');
}

export async function getFinalDocuments(legalProcessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data } = await (supabase as any)
    .from('generated_documents')
    .select('id, document_name, html_content, tiptap_content, created_at')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', false)
    .order('created_at', { ascending: true }) as {
      data: { id: string; document_name: string | null; html_content: string | null; tiptap_content: unknown; created_at: string }[] | null;
    };

  return data ?? [];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    email: string | null;
  } | null;
}

/**
 * Returns all audit_logs entries for a given legal process.
 * Accessible by any active member of the organization that owns the process.
 */
export async function getProcessAuditLogs(legalProcessId: string): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('Unauthorized');

  const isSuperAdmin = profile.system_role === 'SUPERADMIN';

  if (!isSuperAdmin && profile.current_organization_id) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', profile.current_organization_id)
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    if (!membership) {
      throw new Error('Forbidden');
    }
  }

  const { data, error } = await (supabase as any)
    .from('audit_logs')
    .select('id, action, entity, entity_id, metadata, created_at, user_id')
    .eq('entity', 'legal_process')
    .eq('entity_id', legalProcessId)
    .order('created_at', { ascending: false }) as {
      data: { id: string; action: string; entity: string; entity_id: string; metadata: Record<string, unknown>; created_at: string; user_id: string | null }[] | null;
      error: { message: string } | null;
    };

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  // Load profile info for each unique user_id
  const userIds = [...new Set(data.map((e) => e.user_id).filter(Boolean))] as string[];
  let profileMap: Record<string, { id: string; firstname: string | null; lastname: string | null; email: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, firstname, lastname, email')
      .in('id', userIds);

    for (const p of profiles ?? []) {
      profileMap[p.id] = p;
    }
  }

  return data.map((entry) => ({
    ...entry,
    user: entry.user_id ? (profileMap[entry.user_id] ?? null) : null,
  }));
}

export async function updateDocumentPreviewContent(
  documentId: string,
  tiptapContent: unknown,
): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  if (!tiptapContent) throw new Error('Contenido vacío');

  const { data: doc, error: docErr } = await db
    .from('generated_documents')
    .select('document_name, legal_process_id, template_id')
    .eq('id', documentId)
    .single() as { data: { document_name: string | null; legal_process_id: string | null; template_id: string | null } | null; error: { message: string } | null };

  if (docErr) throw new Error(`Documento no encontrado: ${docErr.message}`);

  // ── Regenerate HTML server-side so header/footer are preserved ────────────
  let headerHtml = '';
  let footerHtml = '';

  if (doc?.template_id) {
    const { data: tpl } = await db
      .from('legal_templates')
      .select('header_id, footer_id')
      .eq('id', doc.template_id)
      .single() as { data: { header_id: string | null; footer_id: string | null } | null };

    type SideRow = { content: { image?: { url: string; alignment: string } | null; text?: unknown } | null };
    const renderSide = (raw: unknown, position: 'header' | 'footer') => {
      const c = raw as SideRow['content'];
      if (!c) return '';
      let textHtml = '';
      if (c.text) {
        try { textHtml = tiptapJsonToBodyHtml(c.text); } catch { /* skip */ }
      }
      return renderHeaderFooterHtml(c, position, textHtml);
    };

    if (tpl?.header_id) {
      const { data: hRow } = await db
        .from('document_headers')
        .select('content')
        .eq('id', tpl.header_id)
        .single() as { data: SideRow | null };
      if (hRow?.content) headerHtml = renderSide(hRow.content, 'header');
    }
    if (tpl?.footer_id) {
      const { data: fRow } = await db
        .from('document_footers')
        .select('content')
        .eq('id', tpl.footer_id)
        .single() as { data: SideRow | null };
      if (fRow?.content) footerHtml = renderSide(fRow.content, 'footer');
    }
  }

  // Substitute process variables and wrap with layout
  const variableData = doc?.legal_process_id
    ? (await buildDocumentTemplateData(doc.legal_process_id, supabase)).templateData
    : {};
  const bodyHtml = tiptapJsonToBodyHtml(tiptapContent);
  const substitutedBody = substituteVars(bodyHtml, variableData);
  const htmlContent = wrapWithPageLayout(
    substitutedBody,
    doc?.document_name ?? 'Documento Legal',
    { headerHtml, footerHtml },
  );

  const { error: updateErr } = await db
    .from('generated_documents')
    .update({ tiptap_content: tiptapContent, html_content: htmlContent })
    .eq('id', documentId) as { error: { message: string } | null };

  if (updateErr) {
    console.error('[updateDocumentPreviewContent] update falló:', updateErr.message);
    throw new Error(`Error al guardar: ${updateErr.message}`);
  }

  if (doc?.legal_process_id) {
    void (supabase as any).from('audit_logs').insert({
      user_id: user.id,
      action: 'document_preview_updated',
      entity: 'legal_process',
      entity_id: doc.legal_process_id,
      metadata: { document_id: documentId, document_name: doc.document_name },
    });
  }
}

/**
 * Returns the full variable data map for a legal process (client, lawyer, bank,
 * org-rep, etc.) so the client can substitute variables before saving the HTML
 * preview without running TipTap on the server.
 */
// ─── Fees & Payments ──────────────────────────────────────────────────────────

export async function setProcessFee(
  legalProcessId: string,
  totalAmount: number,
  notes?: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('organization_id')
    .eq('id', legalProcessId)
    .single();
  if (!lp) throw new Error('Proceso no encontrado');

  const { error } = await supabase
    .from('legal_process_fees')
    .upsert(
      {
        legal_process_id: legalProcessId,
        organization_id: lp.organization_id!,
        total_amount: totalAmount,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'legal_process_id' },
    );

  if (error) throw new Error(error.message);
  revalidateLegalProcessPaths();
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'nequi' | 'daviplata' | 'other';

export async function registerPayment(
  legalProcessId: string,
  data: {
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    reference?: string;
    notes?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('organization_id')
    .eq('id', legalProcessId)
    .single();
  if (!lp) throw new Error('Proceso no encontrado');

  const { error } = await supabase
    .from('legal_process_payments')
    .insert({
      legal_process_id: legalProcessId,
      organization_id: lp.organization_id!,
      amount: data.amount,
      payment_method: data.paymentMethod,
      payment_date: data.paymentDate,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
    });

  if (error) throw new Error(error.message);

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'payment_registered',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: {
      amount: data.amount,
      payment_method: data.paymentMethod,
      payment_date: data.paymentDate,
      reference: data.reference ?? null,
    },
  });

  revalidateLegalProcessPaths();
}

export async function getProcessFeeAndPayments(legalProcessId: string): Promise<{
  fee: { id: string; total_amount: number; currency: string; notes: string | null } | null;
  payments: { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string }[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const [{ data: fee }, { data: payments }] = await Promise.all([
    supabase
      .from('legal_process_fees')
      .select('id, total_amount, currency, notes')
      .eq('legal_process_id', legalProcessId)
      .maybeSingle(),
    supabase
      .from('legal_process_payments')
      .select('id, amount, payment_method, payment_date, reference, notes, created_at')
      .eq('legal_process_id', legalProcessId)
      .order('payment_date', { ascending: true }),
  ]);

  return {
    fee: fee ?? null,
    payments: (payments ?? []) as { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string }[],
  };
}

// ─── Document template data ───────────────────────────────────────────────────

/**
 * Resends the initial invitation email to the client for a draft process.
 * Refreshes the access token expiry (72 h from now) and sends the form URL.
 */
export async function resendDraftEmail(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('status, organization_id, email')
    .eq('id', legalProcessId)
    .single();

  if (!lp) throw new Error('Proceso no encontrado');
  if (lp.status !== 'draft') throw new Error('Solo se puede reenviar el email en procesos en borrador');

  // Generate a fresh token, reset used flag, and extend expiry to 72 h from now
  const newToken = randomUUID();
  const newExpiry = new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString();
  await supabase
    .from('legal_processes')
    .update({ access_token: newToken, access_token_used: false, access_token_expires_at: newExpiry } as never)
    .eq('id', legalProcessId);

  const token = newToken;

  const formUrl = `${process.env.NEXT_PUBLIC_APP_URL}/legal-process/validate-token?token=${token}`;

  // Get client email (prefer legal_process_clients record, fall back to lp.email)
  const { data: clientRecord } = await supabase
    .from('legal_process_clients')
    .select('email, first_name')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();

  const toEmail = clientRecord?.email ?? lp.email;
  if (!toEmail) throw new Error('No se encontró un email de destinatario');

  // Fetch org name for email branding
  const { data: org } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { name: string | null } | null }> } } } })
    .from('organizations')
    .select('name')
    .eq('id', lp.organization_id ?? '')
    .maybeSingle();

  const orgName = org?.name ?? 'Aurali Legal';
  const firstName = clientRecord?.first_name ?? '';
  const greeting = firstName ? `Hola, ${firstName}` : 'Hola';

  const bodyHtml = `<p>${greeting},</p><p>Te recordamos que tienes un proceso legal pendiente de iniciar. Por favor ingresa al siguiente enlace para completar tu información y dar inicio a tu proceso.</p>`;

  const { resend } = await import('@/lib/resend');
  const React = await import('react');
  const { render } = await import('@react-email/render');
  const { WorkflowEmail } = await import('@/emails/WorkflowEmail');

  const html = await render(
    React.createElement(WorkflowEmail, {
      bodyHtml,
      ctaUrl: formUrl,
      ctaLabel: 'Completar formulario →',
      subject: 'Tu proceso legal está listo para iniciarse',
      theme: { orgName },
    }),
  );

  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@aurali.app',
    to: toEmail,
    subject: 'Tu proceso legal está listo para iniciarse',
    html,
  });

  if (emailError) throw new Error(`Error al enviar el email: ${(emailError as { message: string }).message}`);

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'email_resent',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { to: toEmail, source: 'manual_resend' },
  });
}

export async function getProcessTemplateData(
  legalProcessId: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { templateData } = await buildDocumentTemplateData(legalProcessId, supabase);
  return templateData;
}
