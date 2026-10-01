'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { startWorkflow, resumeWorkflow, retryWorkflow, executeDocumentWithTemplates, executeEmailWithAttachments, executeSendEmailWithThirdPartyEmails } from '@/lib/workflow/workflowRunner';
import { autoAdvanceWorkflow } from '@/lib/workflow/autoAdvance';
import { buildDocumentTemplateData, resolveBodyHtml, substituteVars, inlineFormButton } from '@/lib/workflow/nodeExecutors';
import type { ExecutionContext } from '@/lib/workflow/types';
import { tiptapJsonToBodyHtml } from '@/lib/documents/tiptapServer';
import { approveGeneratedDocument } from '@/lib/onlyoffice/approveDocument';
import type { FormSchema } from '@/lib/forms/types';
import { resolveSectionOptions } from '@/lib/forms/catalogOptions';
import { resolveFormResponseFileUrls } from '@/lib/forms/resolveFormResponseFileUrls';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';
import { buildTrackingMessageId, determineReplyCapture } from '@/lib/email/inboundReply';
import { fetchLatestGmailThreadReply } from '@/lib/email/gmail/gmailInboxClient';
import { getValidGoogleAccessToken } from '@/lib/email/providers/googleEmailService';
import { resolveEmailReply, tryResolvePendingReplyOnApproval } from '@/lib/workflow/emailReplyResolution';

type LocalizedString = {
  es?: string;
  en?: string;
};

// Vigencia del enlace público del formulario del cliente (legal_processes.
// access_token) desde que se genera/renueva. El enlace deja de servir antes
// de este plazo solo si el cliente TERMINA el formulario (access_token_used
// se marca ahí, no al simple abrir — ver confirmClientFormAccess en
// (public)/legal-process/client-side/[id]/[step]/actions.ts). Fijo por ahora;
// candidato a moverse a un ajuste por organización más adelante.
const CLIENT_FORM_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

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
        `first_name.ilike.%${search}%,` +
        `last_name.ilike.%${search}%,` +
        `email.ilike.%${search}%,` +
        `document_number.ilike.%${search}%`,
        { referencedTable: 'legal_process_clients' }
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

  // legal_process_clients.first_name/last_name solo se llenan hoy desde el
  // formulario legado (personal-data hardcoded); un proceso con un formulario
  // dinámico del DFB guarda el nombre dentro de legal_process_form_responses
  // con alguna de las keys convencionales (nombres/apellidos o su equivalente
  // en inglés first_name/last_name — ver dynamic-actions.ts). Si ya existen
  // respuestas, se usan como fallback para no mostrar "Proceso no iniciado"
  // cuando el cliente sí completó el formulario.
  const missingNameIds = mappedProcesses
    .filter((p) => p.form_schema_id && !p.client?.first_name && !p.client?.last_name)
    .map((p) => p.id);

  if (missingNameIds.length > 0) {
    const { data: responseRows } = await supabase
      .from('legal_process_form_responses')
      .select('legal_process_id, data')
      .in('legal_process_id', missingNameIds);

    const namesByProcessId = new Map<string, { first_name?: string; last_name?: string }>();
    for (const row of responseRows ?? []) {
      const data = row.data as Record<string, unknown>;
      const firstName = data.nombres ?? data.first_name ?? data.CLIENT__FIRST_NAME;
      const lastName = data.apellidos ?? data.last_name ?? data.CLIENT__LAST_NAME;
      const existing = namesByProcessId.get(row.legal_process_id) ?? {};
      if (typeof firstName === 'string' && firstName) existing.first_name = firstName;
      if (typeof lastName === 'string' && lastName) existing.last_name = lastName;
      namesByProcessId.set(row.legal_process_id, existing);
    }

    for (const process of mappedProcesses) {
      const names = namesByProcessId.get(process.id);
      if (!names) continue;
      process.client = { ...(process.client as object ?? {}), ...names } as typeof process.client;
    }
  }

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

/**
 * Tipos de proceso legal (workflow_templates) activos para la organización
 * actual. Cuando hay más de uno, la UI de creación de caso muestra un
 * selector "Tipo de proceso"; con uno solo, se usa automáticamente sin
 * mostrar nada (comportamiento previo intacto).
 */
export async function getActiveWorkflowTemplates(): Promise<
  { id: string; name: string; is_legacy_form: boolean }[]
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) return [];

  const { data, error } = await supabase
    .from('organization_workflows')
    .select('workflow_template_id, workflow_templates(id, name, is_legacy_form)')
    .eq('organization_id', profile.current_organization_id)
    .eq('is_active', true);

  if (error) {
    console.error('getActiveWorkflowTemplates error:', error);
    return [];
  }

  return (data ?? [])
    .map((row: { workflow_templates: { id: string; name: string; is_legacy_form: boolean } | null }) => row.workflow_templates)
    .filter((wf: unknown): wf is { id: string; name: string; is_legacy_form: boolean } => Boolean(wf));
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

  const { data, error } = await supabase
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
  /** Requerido solo cuando la organización tiene más de un tipo de proceso activo. */
  workflow_template_id?: string;
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
    const normalizedEmail = values.email.trim().toLowerCase();

    // Resolve which workflow_template (= tipo de proceso legal) applies to this
    // case. Orgs with a single active workflow keep the previous behavior
    // (no selection needed); orgs with several require values.workflow_template_id.
    const { data: activeWorkflows, error: activeWorkflowsError } = await supabase
      .from('organization_workflows')
      .select('workflow_template_id')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (activeWorkflowsError) {
      throw new Error(activeWorkflowsError.message);
    }
    if (!activeWorkflows || activeWorkflows.length === 0) {
      throw new Error('La organización no tiene un flujo de trabajo activo asignado');
    }

    let chosenWorkflowTemplateId: string;
    if (activeWorkflows.length === 1) {
      chosenWorkflowTemplateId = activeWorkflows[0].workflow_template_id;
    } else {
      if (!values.workflow_template_id) {
        throw new Error('Debes seleccionar un tipo de proceso');
      }
      const match = activeWorkflows.find((w) => w.workflow_template_id === values.workflow_template_id);
      if (!match) {
        throw new Error('El tipo de proceso seleccionado no está activo para tu organización');
      }
      chosenWorkflowTemplateId = values.workflow_template_id;
    }

    // Snapshot the currently published dynamic form schema (if any) for that
    // workflow_template — legacy templates simply have no published schema.
    // A workflow_template can have more than one published form (several
    // formularios asociados al mismo flujo); hasta que exista soporte para
    // elegir cuál corresponde a cada caso, se usa el más recientemente
    // actualizado como default determinístico.
    const { data: publishedSchemas } = await supabase
      .from('legal_process_form_schemas')
      .select('id')
      .eq('workflow_template_id', chosenWorkflowTemplateId)
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(1);

    const publishedSchema = publishedSchemas?.[0];

  // Look up existing client scoped to this org to avoid cross-org matches
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', normalizedEmail)
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
          email: normalizedEmail,
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
            .eq('email', normalizedEmail)
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
        access_token_expires_at: new Date(Date.now() + CLIENT_FORM_ACCESS_TOKEN_TTL_MS).toISOString(),
        created_by: user.id,
        form_schema_id: publishedSchema?.id ?? null,
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
          email: normalizedEmail,
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
  // Start the workflow — it will send the invitation email automatically
  // via the send_email node configured with email_template: 'client_form_email'
    await startWorkflow(chosenWorkflowTemplateId, newLegalProcess.id);

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
        client_email: normalizedEmail,
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

  const [{ data: clientData }, { data: bankingData }, { data: feeData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('legal_process_clients')
      .select('*')
      .eq('legal_process_id', legalProcessId)
      .single(),
    supabase
      .from('legal_process_banks')
      .select('*')
      .eq('legal_process_id', legalProcessId)
      .single(),
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

  if (clientData) {
    const [frontResult, backResult] = await Promise.all([
      clientData.document_front_image && !clientData.document_front_image.startsWith('http')
        ? supabase.storage.from('documents').createSignedUrl(clientData.document_front_image, 3600)
        : null,
      clientData.document_back_image && !clientData.document_back_image.startsWith('http')
        ? supabase.storage.from('documents').createSignedUrl(clientData.document_back_image, 3600)
        : null,
    ]);

    if (frontResult) {
      if (frontResult.data) clientData.document_front_image = frontResult.data.signedUrl;
      else console.error('createSignedUrl failed for document_front_image', frontResult.error);
    }
    if (backResult) {
      if (backResult.data) clientData.document_back_image = backResult.data.signedUrl;
      else console.error('createSignedUrl failed for document_back_image', backResult.error);
    }
  }

  let formSchema: FormSchema | null = null;
  let formResponses: Record<string, Record<string, unknown>> = {};

  if (legalProcess.form_schema_id) {
    const [{ data: schemaRow }, { data: responseRows }] = await Promise.all([
      supabase
        .from('legal_process_form_schemas')
        .select('schema')
        .eq('id', legalProcess.form_schema_id)
        .maybeSingle(),
      supabase
        .from('legal_process_form_responses')
        .select('section_key, data')
        .eq('legal_process_id', legalProcessId),
    ]);

    if (schemaRow?.schema) {
      formSchema = schemaRow.schema as unknown as FormSchema;

      // Resuelve las `options` de los campos con optionsSource (catalog_banks/
      // catalog_documents) contra el catálogo de la organización — sin esto,
      // DynamicResponseViewer no tiene cómo mostrar el nombre del banco/tipo
      // de documento seleccionado y termina mostrando el id/code crudo.
      if (legalProcess.organization_id) {
        const organizationId = legalProcess.organization_id;
        formSchema = {
          ...formSchema,
          sections: await Promise.all(
            formSchema.sections.map((section) => resolveSectionOptions(section, supabase, organizationId)),
          ),
        };
      }

      formResponses = Object.fromEntries(
        (responseRows ?? []).map((r) => [r.section_key, r.data as Record<string, unknown>]),
      );
      await resolveFormResponseFileUrls(supabase, formSchema, formResponses);
    }
  }

  // Documentos que el cliente adjuntó al responder un correo del nodo
  // wait_email_reply (ver app/api/webhooks/email-inbound/route.ts) — nunca
  // vienen de generated_documents ni de document_signature_items. Reemplazan
  // al flujo de firma vía portal manual: el abogado los aprueba/rechaza acá
  // mismo (ver approveEmailAttachmentAction/rejectEmailAttachmentAction).
  // Documentos originalmente enviados al cliente (generate_document, no
  // preview) — el nombre del archivo que el cliente adjunta al responder
  // puede no coincidir con el original (lo renombra, lo escanea de nuevo,
  // etc.), así que el abogado elige a mano cuál de estos representa cada
  // adjunto recibido (ver setEmailAttachmentMatchAction).
  const [{ data: emailAttachmentRows }, { data: sentDocumentRows }] = await Promise.all([
    supabase
      .from('legal_process_email_attachments')
      .select('id, filename, file_url, storage_path, content_type, received_at, status, rejection_reason, matched_document_id, notified_at')
      .eq('legal_process_id', legalProcessId)
      .order('received_at', { ascending: false }),
    supabase
      .from('generated_documents')
      .select('id, document_name, file_url, storage_path, created_at')
      .eq('legal_process_id', legalProcessId)
      .eq('is_preview', false)
      .order('created_at', { ascending: true }),
  ]);

  // El file_url guardado en ambas tablas es una signed URL de UNA sola vez, al
  // subir/generar el archivo (ver generateOnlyOfficeDocument.ts y
  // emailReplyResolution.ts) — expira a los 7 días y, pasado ese tiempo, ni el
  // botón "Ver" ni la miniatura de PdfThumbnail funcionan (ambos usan el mismo
  // valor vencido). Se regenera acá, fresca, en cada carga del panel.
  const SIGNED_URL_TTL = 60 * 60; // 1h — de sobra para una sesión de visualización

  type EmailAttachmentRow = {
    id: string; filename: string; file_url: string | null; storage_path: string | null; content_type: string | null; received_at: string;
    status: string; rejection_reason: string | null; matched_document_id: string | null; notified_at: string | null;
  };
  type SentDocumentRow = { id: string; document_name: string | null; file_url: string | null; storage_path: string | null; created_at: string };

  const [refreshedEmailAttachments, refreshedSentDocuments] = await Promise.all([
    Promise.all(
      ((emailAttachmentRows ?? []) as EmailAttachmentRow[]).map(async (row) => {
        if (!row.storage_path) return row;
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, SIGNED_URL_TTL);
        return { ...row, file_url: signed?.signedUrl ?? row.file_url };
      }),
    ),
    Promise.all(
      ((sentDocumentRows ?? []) as SentDocumentRow[]).map(async (row) => {
        if (!row.storage_path) return row;
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, SIGNED_URL_TTL);
        return { ...row, file_url: signed?.signedUrl ?? row.file_url };
      }),
    ),
  ]);

  return {
    process: legalProcess,
    client: clientData ?? null,
    banking: bankingData ?? null,
    fee: feeData ?? null,
    payments: (paymentsData ?? []) as { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string }[],
    formSchema,
    formResponses,
    emailAttachments: refreshedEmailAttachments as {
      id: string; filename: string; file_url: string | null; content_type: string | null; received_at: string;
      status: string; rejection_reason: string | null; matched_document_id: string | null; notified_at: string | null;
    }[],
    sentDocuments: refreshedSentDocuments as { id: string; document_name: string | null; file_url: string | null; created_at: string }[],
  };
}

/**
 * Consulta el hilo de Gmail del seguimiento directamente (Gmail
 * threads.get), sin esperar al webhook de Pub/Sub — para cuando el cliente ya
 * respondió antes de que el watch quedara activo (p.ej. reconexión tardía de
 * Google) y por eso nunca aparece en users.history.list. Idempotente: si no
 * hay mensaje nuevo en el hilo, no hace nada.
 */
export async function syncEmailFollowUpAction(
  followUpId: string,
  legalProcessId: string,
): Promise<{ found: boolean }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: followUp } = await supabase
    .from('email_follow_ups')
    .select('id, organization_id, legal_process_id, workflow_run_id, requires_attachments, google_thread_id, status, capture_mode')
    .eq('id', followUpId)
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();

  if (!followUp || followUp.capture_mode !== 'google' || followUp.status !== 'pending' || !followUp.google_thread_id) {
    throw new Error('No hay un seguimiento de Gmail pendiente para sincronizar');
  }

  const tokens = await getValidGoogleAccessToken(followUp.organization_id);
  if (!tokens) throw new Error('La organización no tiene una cuenta de Google conectada');

  const reply = await fetchLatestGmailThreadReply(tokens.accessToken, followUp.google_thread_id);
  if (!reply) return { found: false };

  const adminSupabase = await createClient({ admin: true });
  const result = await resolveEmailReply(adminSupabase, followUp, {
    from: reply.from,
    subject: reply.subject,
    text: reply.text,
    attachments: reply.attachments,
  });

  revalidateLegalProcessPaths();
  return { found: result !== null };
}

/**
 * Aprueba/rechaza un documento recibido por respuesta de correo
 * (legal_process_email_attachments) — reemplaza, para este canal, el ciclo de
 * revisión que signature-actions.ts implementa para document_signature_items
 * (flujo de portal manual, en desuso). No hay reenvío automático al cliente
 * en el rechazo: a diferencia del portal, no hay un link de re-subida — el
 * abogado da seguimiento por correo directamente si hace falta corregir algo.
 */
export async function approveEmailAttachmentAction(attachmentId: string, legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: attachment } = await supabase
    .from('legal_process_email_attachments')
    .select('id, organization_id, filename')
    .eq('id', attachmentId)
    .single();
  if (!attachment) throw new Error('Documento no encontrado');

  await supabase
    .from('legal_process_email_attachments')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString(), rejection_reason: null })
    .eq('id', attachmentId);

  // El nodo wait_email_reply solo avanza cuando el número de documentos
  // aprobados alcanza el número de documentos requeridos por el proceso —
  // esta aprobación puede ser justo la que completa el conteo.
  const { resolved, status } = await tryResolvePendingReplyOnApproval(supabase, legalProcessId);

  await supabase.from('audit_logs').insert({
    organization_id: attachment.organization_id,
    user_id: user.id,
    action: 'email_attachment_approved',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: {
      attachment_id: attachmentId,
      filename: attachment.filename,
      required_documents: status.required,
      approved_documents: status.approved,
      documents_complete: status.complete,
      workflow_resumed: resolved,
    },
  });

  // Solo cuando la aprobación reanuda el workflow (resolved=true) puede
  // haber cambiado algo visible en la lista de procesos (p. ej. su status) —
  // en el caso normal (aprobación parcial, todavía esperando más documentos)
  // no hay nada que invalidar ahí. El panel de detalle ya refresca su propia
  // data con loadData(); revalidar aquí sin necesidad solo provoca que toda
  // la página de /legal-process se vuelva a renderizar detrás del panel.
  if (resolved) revalidatePath('/legal-process');
}

export async function rejectEmailAttachmentAction(
  attachmentId: string,
  legalProcessId: string,
  reason?: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: attachment } = await supabase
    .from('legal_process_email_attachments')
    .select('id, organization_id, filename')
    .eq('id', attachmentId)
    .single();
  if (!attachment) throw new Error('Documento no encontrado');

  await supabase
    .from('legal_process_email_attachments')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', attachmentId);

  await supabase.from('audit_logs').insert({
    organization_id: attachment.organization_id,
    user_id: user.id,
    action: 'email_attachment_rejected',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { attachment_id: attachmentId, filename: attachment.filename, reason: reason || null },
  });

  // Rechazar un adjunto no cambia nada visible en la lista de /legal-process
  // (esa tabla no se selecciona ahí) — el panel de detalle ya refresca su
  // propia data con loadData(). No hay nada que revalidar.
}

/**
 * Asocia (o desasocia, con documentId=null) un documento recibido por correo
 * al documento originalmente enviado (generated_documents) que representa —
 * el nombre de archivo que llega en la respuesta del cliente no tiene por qué
 * coincidir con el original, así que esta elección es manual, no inferida.
 * Editable en cualquier momento, sin importar el status de revisión.
 */
export async function setEmailAttachmentMatchAction(
  attachmentId: string,
  legalProcessId: string,
  documentId: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: attachment } = await supabase
    .from('legal_process_email_attachments')
    .select('id, organization_id, filename')
    .eq('id', attachmentId)
    .single();
  if (!attachment) throw new Error('Documento no encontrado');

  await supabase
    .from('legal_process_email_attachments')
    .update({ matched_document_id: documentId })
    .eq('id', attachmentId);

  await supabase.from('audit_logs').insert({
    organization_id: attachment.organization_id,
    user_id: user.id,
    action: 'email_attachment_matched',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { attachment_id: attachmentId, filename: attachment.filename, matched_document_id: documentId },
  });

  // Vincular/desvincular un adjunto por DnD no cambia nada visible en la
  // lista de /legal-process — el panel de detalle ya refresca su propia data
  // con loadData(). Revalidar aquí en cada soltada solo provoca que toda esa
  // página se vuelva a renderizar detrás del panel.
}

/**
 * Notifica al cliente los documentos que el abogado rechazó (agrupa TODOS
 * los rechazados de este proceso que aún no se han notificado en un solo
 * correo, en vez de uno por documento) y reabre la captura de su corrección:
 * el correo sale con el mismo mecanismo de reply_token/capture_mode que usa
 * executeSendEmail (lib/workflow/nodeExecutors.ts) para el nodo
 * wait_email_reply, creando una fila nueva en email_follow_ups
 * (workflow_run_id: null — no hay un run que reanudar, el pipeline de
 * recepción ya soporta esto sin cambios: resolveEmailReply solo llama
 * resumeWorkflow si workflow_run_id no es null). Cuando el cliente responda
 * con la corrección, el webhook/poller de siempre la captura igual que
 * cualquier otra respuesta.
 */
export async function notifyRejectedEmailAttachmentsAction(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: rejectedAttachments } = await supabase
    .from('legal_process_email_attachments')
    .select('id, filename, subject, rejection_reason, matched_document_id, email_follow_up_id, organization_id')
    .eq('legal_process_id', legalProcessId)
    .eq('status', 'rejected')
    .is('notified_at', null);

  if (!rejectedAttachments || rejectedAttachments.length === 0) {
    throw new Error('No hay documentos rechazados pendientes de notificar');
  }

  const organizationId = rejectedAttachments[0].organization_id;

  const { data: followUp } = await supabase
    .from('email_follow_ups')
    .select('to_email')
    .eq('id', rejectedAttachments[0].email_follow_up_id)
    .single();
  const toEmail = followUp?.to_email;
  if (!toEmail) throw new Error('No se encontró el correo del cliente para este documento');

  const matchedDocumentIds = rejectedAttachments
    .map((a) => a.matched_document_id)
    .filter((id): id is string => !!id);
  const { data: matchedDocuments } = matchedDocumentIds.length > 0
    ? await supabase.from('generated_documents').select('id, document_name').in('id', matchedDocumentIds)
    : { data: [] as { id: string; document_name: string | null }[] };
  const documentNameById = new Map((matchedDocuments ?? []).map((d) => [d.id, d.document_name]));

  const capture = await determineReplyCapture(organizationId);
  if (!capture) throw new Error('La organización no tiene IMAP configurado — configúralo en Ajustes → Correo para poder recibir la corrección del cliente.');
  const { replyToken, captureMode } = capture;

  const deadlineAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: newFollowUp, error: followUpErr } = await supabase
    .from('email_follow_ups')
    .insert({
      organization_id: organizationId,
      legal_process_id: legalProcessId,
      workflow_run_id: null,
      node_id: 'manual:email_attachment_rejection',
      to_email: toEmail,
      resolution_mode: 'reply',
      requires_receipt: false,
      requires_attachments: true,
      capture_mode: captureMode,
      reply_token: replyToken,
      deadline_at: deadlineAt,
    })
    .select('id')
    .single();
  if (followUpErr || !newFollowUp) throw new Error(followUpErr?.message ?? 'No se pudo registrar el seguimiento');

  const itemsHtml = rejectedAttachments
    .map((a) => {
      const name = (a.matched_document_id && documentNameById.get(a.matched_document_id)) || a.filename;
      const reason = a.rejection_reason || 'No cumple con lo requerido';
      return `<li><strong>${name}</strong>: ${reason}</li>`;
    })
    .join('');
  const bodyHtml = `<p>Hola,</p>
    <p>Revisamos los documentos que enviaste y encontramos un problema con ${rejectedAttachments.length === 1 ? 'el siguiente' : 'los siguientes'}:</p>
    <ul>${itemsHtml}</ul>
    <p>Por favor responde a este correo adjuntando la versión corregida.</p>`;

  const originalSubject = rejectedAttachments.find((a) => a.subject)?.subject;
  const subject = originalSubject ? `Re: ${originalSubject}` : 'Debes corregir uno o más documentos enviados';

  await sendOrgEmail(
    organizationId,
    {
      to: toEmail,
      subject,
      bodyHtml,
      messageId: captureMode === 'imap' ? buildTrackingMessageId(replyToken) : undefined,
    },
    { strict: true },
  );

  const notifiedIds = rejectedAttachments.map((a) => a.id);
  await supabase
    .from('legal_process_email_attachments')
    .update({ notified_at: new Date().toISOString() })
    .in('id', notifiedIds);

  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    action: 'email_attachments_rejection_notified',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { attachment_ids: notifiedIds, email_follow_up_id: newFollowUp.id, to: toEmail },
  });

  // Notificar al cliente tampoco cambia nada visible en la lista de
  // /legal-process — el panel de detalle ya refresca su propia data.
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

  const [{ data: process }, { error }] = await Promise.all([
    supabase
      .from('legal_processes')
      .select('status, organization_id')
      .eq('id', legalProcessId)
      .single(),
    supabase
      .from('legal_processes')
      .update({ status: newStatus })
      .eq('id', legalProcessId),
  ]);

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

  const { error } = await supabase
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

  const { data: process } = await supabase
    .from('legal_processes')
    .select('status, previous_status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!process) throw new Error('Proceso no encontrado');
  if (process.status !== 'archived') {
    throw new Error('Solo se pueden revertir procesos en estado archivado');
  }

  const restoredStatus = process.previous_status ?? 'draft';

  const { error } = await supabase
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
  | { kind: 'document_attachment_selection'; workflowRunId: string; nodeTitle: string; availableDocuments: { id: string; name: string }[] }
  | { kind: 'third_party_email_input';       workflowRunId: string; nodeTitle: string };

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

  const { data: run } = await supabase
    .from('workflow_runs')
    .select('id, template_id, current_node_id, status')
    .eq('id', lp.workflow_run_id)
    .single() as { data: { id: string; template_id: string; current_node_id: string | null; status: string } | null };

  if (!run || !run.current_node_id) return null;

  // ── Failed run: allow retry ─────────────────────────────────────────────────
  if (run.status === 'failed') {
    const { data: failedStep } = await supabase
      .from('workflow_step_runs')
      .select('output')
      .eq('workflow_run_id', run.id)
      .eq('node_id', run.current_node_id)
      .eq('status', 'failed')
      .maybeSingle() as { data: { output: Record<string, unknown> } | null };

    const { data: node } = await supabase
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
  const { data: runningSteps } = await supabase
    .from('workflow_step_runs')
    .select('node_id, output')
    .eq('workflow_run_id', run.id)
    .eq('status', 'running') as { data: { node_id: string; output: Record<string, unknown> }[] | null };

  if (!runningSteps || runningSteps.length === 0) return null;

  for (const step of runningSteps) {
    const stepOutput = (step.output ?? {}) as Record<string, unknown>;

    const { data: node } = await supabase
      .from('workflow_nodes')
      .select('title, config, type')
      .eq('template_id', run.template_id)
      .eq('node_id', step.node_id)
      .single();

    if (!node) continue;

    if (node.type === 'manual_action') {
      const rawInstructions = (node.config as { instructions?: unknown } | null)?.instructions;
      const instructions = !rawInstructions
        ? null
        : typeof rawInstructions === 'string'
          ? rawInstructions.replace(/\n/g, '<br>')
          : tiptapJsonToBodyHtml(rawInstructions);

      return {
        kind:          'manual_action',
        workflowRunId: run.id,
        nodeTitle:     node.title,
        instructions,
      };
    }

    if (node.type === 'send_email' && stepOutput.waitingFor === 'third_party_email') {
      return {
        kind:          'third_party_email_input',
        workflowRunId: run.id,
        nodeTitle:     node.title,
      };
    }

    if (node.type === 'send_email' && stepOutput.waitingFor === 'document_attachment_selection') {
      // Solo los documentos que generó el (los) nodo(s) generate_document
      // conectados DIRECTAMENTE antes de este nodo, en esta misma corrida —
      // antes se traían TODOS los documentos no-preview del proceso legal,
      // así que un flujo con más de un generate_document (uno por cada
      // paso) terminaba adjuntando también los de pasos anteriores que no
      // tenían nada que ver con este correo.
      const { data: incomingEdges } = await supabase
        .from('workflow_edges')
        .select('source_node_id')
        .eq('template_id', run.template_id)
        .eq('target_node_id', step.node_id) as { data: { source_node_id: string }[] | null };

      const sourceNodeIds = (incomingEdges ?? []).map((e) => e.source_node_id);

      const { data: sourceNodes } = sourceNodeIds.length > 0
        ? await supabase
            .from('workflow_nodes')
            .select('node_id, type')
            .eq('template_id', run.template_id)
            .in('node_id', sourceNodeIds)
        : { data: [] as { node_id: string; type: string }[] };

      const generateDocumentNodeIds = (sourceNodes ?? [])
        .filter((n) => n.type === 'generate_document')
        .map((n) => n.node_id);

      let docs: { id: string; document_name: string | null }[] = [];

      if (generateDocumentNodeIds.length > 0) {
        const { data: scopedDocs } = await supabase
          .from('generated_documents')
          .select('id, document_name')
          .eq('workflow_run_id', run.id)
          .eq('is_preview', false)
          .in('node_id', generateDocumentNodeIds) as { data: { id: string; document_name: string | null }[] | null };
        docs = scopedDocs ?? [];
      }

      // Compatibilidad hacia atrás: corridas iniciadas antes de que
      // generated_documents guardara workflow_run_id/node_id no tienen cómo
      // filtrarse así — en ese caso se cae al comportamiento anterior (todos
      // los documentos del proceso) en vez de no ofrecer ninguno.
      if (docs.length === 0 && generateDocumentNodeIds.length > 0) {
        const { data: legacyDocs } = await supabase
          .from('generated_documents')
          .select('id, document_name')
          .eq('legal_process_id', legalProcessId)
          .eq('is_preview', false)
          .is('workflow_run_id', null) as { data: { id: string; document_name: string | null }[] | null };
        docs = legacyDocs ?? [];
      }

      return {
        kind:               'document_attachment_selection',
        workflowRunId:      run.id,
        nodeTitle:          node.title,
        availableDocuments: docs.map((d) => ({ id: d.id, name: d.document_name ?? 'Documento sin nombre' })),
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
        const { count } = await supabase
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

export async function confirmThirdPartyEmails(
  legalProcessId: string,
  emails: string[],
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

  await executeSendEmailWithThirdPartyEmails(lp.workflow_run_id, emails);

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
  /** Only set for send_email/send_documents nodes — see resolveEmailCategory. */
  email_category: 'form' | 'documents' | 'other' | null;
}

/**
 * Mirrors the categorization executeSendEmail applies when it actually sends
 * (lib/workflow/nodeExecutors.ts) so the timeline can decide whether a past
 * send_email/send_documents step is resendable — computed from the node's
 * current config rather than the step's stored output, so it works for steps
 * that ran before this field existed too.
 */
function resolveEmailCategory(nodeType: string, nodeConfig: Record<string, unknown> | null): 'form' | 'documents' | 'other' | null {
  if (nodeType === 'send_documents') return 'documents';
  if (nodeType !== 'send_email') return null;
  if (nodeConfig?.email_template === 'client_form_email') return 'form';
  if (nodeConfig?.attach_enabled) return 'documents';
  return 'other';
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
  const { data: run } = await supabase
    .from('workflow_runs')
    .select('id, template_id')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; template_id: string } | null };

  if (!run) return [];

  // Get all step runs for this workflow run
  const { data: steps, error } = await supabase
    .from('workflow_step_runs')
    .select('id, node_id, status, output, created_at, executed_at')
    .eq('workflow_run_id', run.id)
    .order('created_at', { ascending: true }) as {
      data: { id: string; node_id: string; status: string; output: Record<string, unknown>; created_at: string; executed_at: string | null }[] | null;
      error: { message: string } | null;
    };

  if (error || !steps || steps.length === 0) return [];

  // Load node metadata (title, type, config) for all nodes in this template
  const { data: nodes } = await supabase
    .from('workflow_nodes')
    .select('node_id, title, type, config')
    .eq('template_id', run.template_id) as {
      data: { node_id: string; title: string; type: string; config: Record<string, unknown> | null }[] | null;
    };

  const nodeMap = Object.fromEntries((nodes ?? []).map((n) => [n.node_id, n]));

  return steps.map((step) => {
    const node = nodeMap[step.node_id];
    return {
      id:          step.id,
      node_id:     step.node_id,
      node_title:  node?.title ?? step.node_id,
      node_type:   node?.type  ?? 'unknown',
      email_category: resolveEmailCategory(node?.type ?? '', node?.config ?? null),
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

  const { data } = await supabase
    .from('generated_documents')
    .select('id, document_name, docx_storage_path, created_at')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', true)
    .order('created_at', { ascending: true }) as {
      data: { id: string; document_name: string | null; docx_storage_path: string | null; created_at: string }[] | null;
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  // ── 1. Get the running workflow run ──────────────────────────────────────
  const { data: lp } = await supabase
    .from('legal_processes')
    .select('workflow_run_id, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp?.workflow_run_id) throw new Error('No hay flujo de trabajo asociado');

  const { data: run } = await supabase
    .from('workflow_runs')
    .select('id, template_id, current_node_id, status')
    .eq('id', lp.workflow_run_id)
    .single() as { data: { id: string; template_id: string; current_node_id: string; status: string } | null };

  if (!run || run.status !== 'running' || !run.current_node_id) {
    throw new Error('El flujo de trabajo no está en un estado válido para aprobar documentos');
  }

  // ── 2. Verify current node is generate_document(preview=true) ─────────────
  const { data: node } = await supabase
    .from('workflow_nodes')
    .select('type, config')
    .eq('template_id', run.template_id)
    .eq('node_id', run.current_node_id)
    .single() as { data: { type: string; config: Record<string, unknown> } | null };

  if (!node || node.type !== 'generate_document' || !(node.config as { preview?: boolean }).preview) {
    throw new Error('El flujo no está esperando aprobación de documentos');
  }

  // ── 3. Convert each preview's current .docx (possibly lawyer-edited via the
  //      embedded ONLYOFFICE editor) to a final PDF ────────────────────────
  const { data: previewDocs, error: previewDocsError } = await supabase
    .from('generated_documents')
    .select('id')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', true) as { data: { id: string }[] | null; error: { message: string } | null };

  if (previewDocsError) {
    throw new Error(previewDocsError.message);
  }

  for (const preview of previewDocs ?? []) {
    await approveGeneratedDocument(preview.id, supabase);
  }

  // ── 4. Resume workflow ─────────────────────────────────────────────────────
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

  const { data } = await supabase
    .from('generated_documents')
    .select('id, document_name, file_url, created_at')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', false)
    .order('created_at', { ascending: true }) as {
      data: { id: string; document_name: string | null; file_url: string | null; created_at: string }[] | null;
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

  const { data, error } = await supabase
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
  const profileMap: Record<string, { id: string; firstname: string | null; lastname: string | null; email: string | null }> = {};

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
 * Refreshes the access token expiry (CLIENT_FORM_ACCESS_TOKEN_TTL_MS from now) and sends the form URL.
 */
/**
 * Corrige el correo del cliente en un proceso todavía en borrador — para
 * cuando el abogado lo escribió mal al crear el proceso y el cliente nunca
 * llega a recibir la invitación. Solo permitido en 'draft': una vez que el
 * proceso avanzó, el correo queda fijado a lo que el propio cliente ya usó
 * para responder (cambiarlo después rompería el rastreo de la conversación).
 */
export async function updateDraftClientEmail(legalProcessId: string, newEmail: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const normalizedEmail = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Correo inválido');
  }

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('status, organization_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp) throw new Error('Proceso no encontrado');
  if (lp.status !== 'draft') throw new Error('Solo se puede editar el correo en procesos en borrador');

  const { error: clientError } = await supabase
    .from('legal_process_clients')
    .update({ email: normalizedEmail })
    .eq('legal_process_id', legalProcessId);
  if (clientError) throw new Error(clientError.message);

  // legal_processes.email es un campo de respaldo (no siempre se llena al
  // crear el proceso) — se actualiza igual por consistencia, sin bloquear
  // si falla algo puntual ahí.
  await supabase.from('legal_processes').update({ email: normalizedEmail } as never).eq('id', legalProcessId);

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'client_email_corrected',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { new_email: normalizedEmail },
  });

  revalidateLegalProcessPaths();
}

export async function resendDraftEmail(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: lp } = await supabase
    .from('legal_processes')
    .select('status, organization_id, email, lawyer_id, document_type, document_number, workflow_run_id')
    .eq('id', legalProcessId)
    .single();

  if (!lp) throw new Error('Proceso no encontrado');
  if (lp.status !== 'draft') throw new Error('Solo se puede reenviar el email en procesos en borrador');
  if (!lp.organization_id) throw new Error('El proceso legal no tiene organization_id');

  // Generate a fresh token, reset used flag, and extend expiry (CLIENT_FORM_ACCESS_TOKEN_TTL_MS from now)
  const newToken = randomUUID();
  const newExpiry = new Date(Date.now() + CLIENT_FORM_ACCESS_TOKEN_TTL_MS).toISOString();
  await supabase
    .from('legal_processes')
    .update({ access_token: newToken, access_token_used: false, access_token_expires_at: newExpiry } as never)
    .eq('id', legalProcessId);

  const token = newToken;

  const formUrl = `${process.env.NEXT_PUBLIC_APP_URL}/legal-process/validate-token?token=${token}`;

  // Get client email (prefer legal_process_clients record, fall back to lp.email)
  const { data: clientRecord } = await supabase
    .from('legal_process_clients')
    .select('email, first_name, last_name')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();

  const toEmail = clientRecord?.email ?? lp.email;
  if (!toEmail) throw new Error('No se encontró un email de destinatario');

  // Reuse the org's configured "Enviar formulario al cliente" node (the same
  // template a lawyer edits in Configuración → Flujos de Trabajo) instead of
  // a hardcoded copy, so template edits apply to resends too. Falls back to
  // the old hardcoded copy if the node/template can't be resolved.
  let subject = 'Tu proceso legal está listo para iniciarse';
  let bodyHtml = '<p>Hola,</p><p>Te recordamos que tienes un proceso legal pendiente de iniciar. Por favor ingresa al siguiente enlace para completar tu información y dar inicio a tu proceso.</p>';
  let ctaUrl: string | undefined = formUrl;

  if (lp.workflow_run_id) {
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('template_id')
      .eq('id', lp.workflow_run_id)
      .single();

    if (run?.template_id) {
      const { data: emailNode } = await supabase
        .from('workflow_nodes')
        .select('config')
        .eq('template_id', run.template_id)
        .eq('type', 'send_email')
        .contains('config', { email_template: 'client_form_email' })
        .maybeSingle();

      const cfg = emailNode?.config as { subject?: string; body?: unknown } | undefined;
      if (cfg?.body) {
        const rawBodyHtml = resolveBodyHtml(cfg.body);
        const { bodyHtml: templateWithButton, fallbackCtaUrl } = inlineFormButton(rawBodyHtml, formUrl, 'Completar formulario →');
        ctaUrl = fallbackCtaUrl;

        const context: ExecutionContext = {
          workflowRun: {
            id: lp.workflow_run_id,
            template_id: run.template_id,
            legal_process_id: legalProcessId,
            current_node_id: null,
            status: 'running',
            created_at: new Date().toISOString(),
            completed_at: null,
          },
          legalProcess: {
            id: legalProcessId,
            organization_id: lp.organization_id,
            lawyer_id: lp.lawyer_id,
            email: lp.email,
            status: lp.status,
            workflow_run_id: lp.workflow_run_id,
            document_type: lp.document_type,
            document_number: lp.document_number,
            access_token: token,
            form_url: formUrl,
          },
          previousOutput: {},
          clientData: {
            email: clientRecord?.email ?? '',
            first_name: clientRecord?.first_name ?? '',
            last_name: clientRecord?.last_name ?? '',
          },
        };

        bodyHtml = substituteVars(templateWithButton, context);
        if (cfg.subject) subject = substituteVars(cfg.subject, context);
      }
    }
  }

  await sendOrgEmail(
    lp.organization_id,
    {
      to: toEmail,
      subject,
      bodyHtml,
      ctaUrl,
      ctaLabel: 'Completar formulario →',
    },
    { strict: true },
  );

  void supabase.from('audit_logs').insert({
    organization_id: lp.organization_id,
    user_id: user.id,
    action: 'email_resent',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { to: toEmail, email_category: 'form', source: 'manual_resend' },
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
