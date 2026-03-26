'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { startWorkflow, resumeWorkflow, retryWorkflow } from '@/lib/workflow/workflowRunner';
import { autoAdvanceWorkflow } from '@/lib/workflow/autoAdvance';

type LocalizedString = {
  es?: string;
  en?: string;
};

export async function getLegalProcesses(page: number = 1, pageSize: number = 10, search?: string, status?: string) {
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
    query = query.or(`legal_process_clients.first_name.ilike.%${search}%,legal_process_clients.last_name.ilike.%${search}%,legal_process_clients.email.ilike.%${search}%,legal_process_clients.document_number.ilike.%${search}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: legalProcesses, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

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
  current_organization_id: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  // Look up existing client scoped to this org to avoid cross-org matches
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', values.email)
    .eq('organization_id', values.current_organization_id)
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
        organization_id: values.current_organization_id,
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
          .eq('organization_id', values.current_organization_id)
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
    .insert({
      status: 'draft',
      organization_id: values.current_organization_id,
      lawyer_id: values.assigned_to,
      assigned_to: values.assigned_to,
      access_token: publicToken,
      access_token_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 72 hours
      created_by: user.id,
    })
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
        organization_id: values.current_organization_id,
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
        organization_id: values.current_organization_id,
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
    .eq('organization_id', values.current_organization_id)
    .eq('is_active', true)
    .single();

  if (!orgWorkflow?.workflow_template_id) {
    throw new Error('La organización no tiene un flujo de trabajo activo asignado');
  }

  // Start the workflow — it will send the invitation email automatically
  // via the send_email node configured with email_template: 'client_form_email'
  await startWorkflow(orgWorkflow.workflow_template_id, newLegalProcess.id);

  revalidatePath('/legal-process');
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

  return {
    process: legalProcess,
    client: clientData ?? null,
    banking: bankingData ?? null,
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
    .select('workflow_run_id, status')
    .eq('id', legalProcessId)
    .single();

  if (!process?.workflow_run_id) {
    throw new Error('Este proceso no tiene un flujo de trabajo asociado');
  }

  if (process.status !== 'completed') {
    throw new Error('El proceso debe estar en estado "completado" para marcar el pago');
  }

  await resumeWorkflow(process.workflow_run_id, { paid_at: new Date().toISOString() });

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

export type PendingWorkflowAction =
  | { kind: 'manual_action';    workflowRunId: string; nodeTitle: string; instructions: string | null }
  | { kind: 'failed';           workflowRunId: string; nodeTitle: string; error: string | null }
  | { kind: 'document_preview'; workflowRunId: string; nodeTitle: string; previewCount: number };

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

  // ── Running: check for pending manual_action or document_preview ────────────
  if (run.status !== 'running') return null;

  const { data: node } = await (supabase as any)
    .from('workflow_nodes')
    .select('title, config, type')
    .eq('template_id', run.template_id)
    .eq('node_id', run.current_node_id)
    .single();

  if (!node) return null;

  if (node.type === 'manual_action') {
    return {
      kind:          'manual_action',
      workflowRunId: run.id,
      nodeTitle:     node.title,
      instructions:  (node.config?.instructions as string | null) ?? null,
    };
  }

  if (node.type === 'generate_document' && (node.config as { preview?: boolean }).preview === true) {
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

  return null;
}

export async function retryFailedWorkflow(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  await retryWorkflow(lp.workflow_run_id);
  revalidatePath('/legal-process');
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

export async function updateDocumentPreviewContent(
  documentId: string,
  tiptapContent: unknown,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: doc } = await (supabase as any)
    .from('generated_documents')
    .select('document_name')
    .eq('id', documentId)
    .single() as { data: { document_name: string | null } | null };

  const { tiptapJsonToHtml } = await import('@/lib/documents/generateDocument');
  const html = tiptapJsonToHtml(tiptapContent, doc?.document_name ?? 'Documento Legal');

  await (supabase as any)
    .from('generated_documents')
    .update({ tiptap_content: tiptapContent, html_content: html })
    .eq('id', documentId);
}
