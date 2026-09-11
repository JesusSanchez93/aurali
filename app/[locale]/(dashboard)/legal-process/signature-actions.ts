'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';
import { buildSignatureInstructionsHtml } from '@/lib/email/signatureRequestEmail';
import { tiptapJsonToBodyHtml } from '@/lib/documents/tiptapServer';

export type SignatureItemView = {
  id: string;
  document_name: string;
  original_file_url: string | null;
  signed_file_url: string | null;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string | null;
};

export type SignatureRequestView = {
  id: string;
  client_email: string;
  status: string;
  created_at: string;
  items: SignatureItemView[];
};

export async function getSignatureRequests(legalProcessId: string): Promise<SignatureRequestView[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: requests } = await supabase
    .from('document_signature_requests')
    .select('id, client_email, status, created_at')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: false });

  if (!requests || requests.length === 0) return [];

  const { data: items } = await supabase
    .from('document_signature_items')
    .select('id, request_id, document_name, original_file_url, signed_file_url, status, rejection_reason, uploaded_at')
    .in('request_id', requests.map((r) => r.id))
    .order('created_at', { ascending: true });

  return requests.map((r) => ({
    ...r,
    items: (items ?? []).filter((i) => i.request_id === r.id),
  }));
}

export type EmailFollowUpView = {
  id: string;
  to_email: string;
  resolution_mode: string;
  requires_receipt: boolean;
  status: string;
  deadline_at: string;
  overdue: boolean;
};

/**
 * Reads send_email "seguimiento" rows for a process. There is no scheduler
 * in this project (see supabase/migrations/20260910130000_email_follow_ups.sql)
 * so `overdue` is computed here, on read, rather than by a background job.
 */
export async function getEmailFollowUps(legalProcessId: string): Promise<EmailFollowUpView[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data } = await supabase
    .from('email_follow_ups')
    .select('id, to_email, resolution_mode, requires_receipt, status, deadline_at')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: false });

  const now = Date.now();
  return (data ?? []).map((f) => ({
    ...f,
    overdue: f.status === 'pending' && new Date(f.deadline_at).getTime() < now,
  }));
}

async function refreshRequestStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
): Promise<void> {
  const { data: items } = await supabase
    .from('document_signature_items')
    .select('status')
    .eq('request_id', requestId);

  if (!items || items.length === 0) return;
  const allApproved = items.every((i) => i.status === 'approved');
  const anyRejected = items.some((i) => i.status === 'rejected');

  const nextStatus = allApproved ? 'approved' : anyRejected ? 'rejected' : 'uploaded';

  await supabase
    .from('document_signature_requests')
    .update({ status: nextStatus, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);

  // Resolve the send_email "seguimiento" row (if this request came from a
  // send_email node with requires_document_receipt) once every document is
  // approved — see supabase/migrations/20260910130000_email_follow_ups.sql.
  if (allApproved) {
    await supabase
      .from('email_follow_ups')
      .update({ status: 'received', resolved_at: new Date().toISOString() })
      .eq('signature_request_id', requestId)
      .eq('status', 'pending');
  }
}

export async function approveSignedDocumentAction(itemId: string, legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: item } = await supabase
    .from('document_signature_items')
    .select('id, request_id, document_name')
    .eq('id', itemId)
    .single();
  if (!item) throw new Error('Documento no encontrado');

  await supabase
    .from('document_signature_items')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString(), rejection_reason: null })
    .eq('id', itemId);

  await refreshRequestStatus(supabase, item.request_id);

  const { data: request } = await supabase
    .from('document_signature_requests')
    .select('client_email, organization_id, status')
    .eq('id', item.request_id)
    .single();

  if (request?.status === 'approved') {
    await sendOrgEmail(request.organization_id, {
      to: request.client_email,
      subject: 'Tus documentos firmados fueron aprobados',
      bodyHtml: '<p>Confirmamos que tus documentos firmados fueron revisados y aprobados. No necesitas realizar ninguna acción adicional.</p>',
    });
  }

  await supabase.from('audit_logs').insert({
    organization_id: request?.organization_id,
    user_id: user.id,
    action: 'signature_item_approved',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { signature_item_id: itemId, document_name: item.document_name },
  });

  revalidatePath('/legal-process');
}

export async function rejectSignedDocumentAction(
  itemId: string,
  legalProcessId: string,
  reason?: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: item } = await supabase
    .from('document_signature_items')
    .select('id, request_id, document_name')
    .eq('id', itemId)
    .single();
  if (!item) throw new Error('Documento no encontrado');

  await supabase
    .from('document_signature_items')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', itemId);

  await refreshRequestStatus(supabase, item.request_id);

  const { data: request } = await supabase
    .from('document_signature_requests')
    .select('client_email, organization_id, access_token')
    .eq('id', item.request_id)
    .single();

  if (request) {
    // The access_token never rotates or expires — it stays valid (re-running the
    // OTP step on every visit) until the whole request is approved — so the same
    // link from the original email works for the re-upload too.
    const reasonHtml = reason
      ? `<p>Motivo: ${reason}</p>`
      : '';
    const signUrl = `${process.env.NEXT_PUBLIC_APP_URL}/legal-process/sign-documents/validate-token?token=${request.access_token}`;

    await sendOrgEmail(request.organization_id, {
      to: request.client_email,
      subject: 'Debes corregir un documento firmado',
      bodyHtml: `<p>Uno de tus documentos firmados fue rechazado y debes volver a subirlo.</p>${reasonHtml}`,
      ctaUrl: signUrl,
      ctaLabel: 'Volver a subir →',
    });
  }

  await supabase.from('audit_logs').insert({
    organization_id: request?.organization_id,
    user_id: user.id,
    action: 'signature_item_rejected',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { signature_item_id: itemId, document_name: item.document_name, reason: reason || null },
  });

  revalidatePath('/legal-process');
}

/**
 * Manually resends "the documents email" for this process — e.g. the client
 * says they never got it, or lost it. There are two distinct mechanisms a
 * workflow may use to hand documents to a client, and the resend must exactly
 * reproduce whichever one this process actually used — not a generic
 * reconstruction:
 *
 *  1. document_signature_requests exists → the workflow used the
 *     send_documents node (OTP-gated upload-signed-documents portal). Resend
 *     the same subject/intro text persisted on the original send, over the
 *     same still-valid access_token/link.
 *
 *  2. No signature request exists → the workflow used a plain send_email
 *     node with attach_enabled (the common "documents attached to the email"
 *     flow — see e.g. the "Fraudes Financieros" template's "Enviar
 *     documentos al cliente" node). Look up that exact node's config from
 *     the process's workflow template and resend with the identical
 *     subject/body and the real generated PDFs as attachments.
 */
export async function resendDocumentsEmail(legalProcessId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: existingRequest } = await supabase
    .from('document_signature_requests')
    .select('id, organization_id, client_email, status, access_token, email_subject, email_intro_html')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRequest) {
    await resendSignaturePortalEmail(supabase, user.id, legalProcessId, existingRequest);
  } else {
    await resendAttachedDocumentsEmail(supabase, user.id, legalProcessId);
  }

  revalidatePath('/legal-process');
}

type ExistingSignatureRequest = {
  id: string;
  organization_id: string;
  client_email: string;
  status: string;
  access_token: string;
  email_subject: string | null;
  email_intro_html: string | null;
};

async function resendSignaturePortalEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  legalProcessId: string,
  existingRequest: ExistingSignatureRequest,
): Promise<void> {
  if (existingRequest.status === 'approved') {
    throw new Error('Todos los documentos de esta solicitud ya fueron aprobados');
  }

  const { data: items } = await supabase
    .from('document_signature_items')
    .select('document_name, original_file_url')
    .eq('request_id', existingRequest.id)
    .neq('status', 'approved');

  if (!items || items.length === 0) {
    throw new Error('Todos los documentos de esta solicitud ya fueron aprobados');
  }

  // Older rows created before email_subject/email_intro_html existed fall back
  // to the same defaults executeSendDocuments itself would have used.
  const emailSubject = existingRequest.email_subject ?? 'Debe firmar sus documentos legales';
  const emailIntroHtml = existingRequest.email_intro_html
    ?? `<p>Tiene ${items.length} documento(s) legales que requieren su firma.</p>`;

  // Reproduces the exact email originally sent — same subject, same intro
  // text, same instructions/document list layout, same (still-valid) link.
  const signUrl = `${process.env.NEXT_PUBLIC_APP_URL}/legal-process/sign-documents/validate-token?token=${existingRequest.access_token}`;
  const bodyHtml = buildSignatureInstructionsHtml(
    emailIntroHtml,
    items.map((i) => ({ document_name: i.document_name, file_url: i.original_file_url ?? '' })),
  );

  await sendOrgEmail(existingRequest.organization_id, {
    to: existingRequest.client_email,
    subject: emailSubject,
    bodyHtml,
    ctaUrl: signUrl,
    ctaLabel: 'Firmar documentos →',
  });

  await supabase.from('audit_logs').insert({
    organization_id: existingRequest.organization_id,
    user_id: userId,
    action: 'signature_request_resent',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { signature_request_id: existingRequest.id, to: existingRequest.client_email, email_category: 'documents', source: 'manual_resend' },
  });
}

async function resendAttachedDocumentsEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  legalProcessId: string,
): Promise<void> {
  const { data: legalProcess } = await supabase
    .from('legal_processes')
    .select('organization_id, workflow_run_id, email')
    .eq('id', legalProcessId)
    .single();
  if (!legalProcess?.organization_id) throw new Error('Proceso no encontrado');

  const { data: clientRecord } = await supabase
    .from('legal_process_clients')
    .select('email')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();
  const toEmail = clientRecord?.email ?? legalProcess.email;
  if (!toEmail) throw new Error('No se encontró un correo de destinatario para este proceso');

  const { data: generatedDocs } = await supabase
    .from('generated_documents')
    .select('id, document_name, file_url')
    .eq('legal_process_id', legalProcessId)
    .eq('is_preview', false);
  if (!generatedDocs || generatedDocs.length === 0) {
    throw new Error('Este proceso no tiene documentos generados para enviar al cliente');
  }

  // Find the exact send_email (attach_enabled) node this process's workflow
  // template used to send documents, so subject/body match precisely instead
  // of falling back to invented text.
  let subject = 'Sus documentos legales están listos';
  let bodyHtml = '';
  if (legalProcess.workflow_run_id) {
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('template_id')
      .eq('id', legalProcess.workflow_run_id)
      .single();

    if (run?.template_id) {
      const { data: node } = await supabase
        .from('workflow_nodes')
        .select('config')
        .eq('template_id', run.template_id)
        .eq('type', 'send_email')
        .contains('config', { attach_enabled: true })
        .limit(1)
        .maybeSingle();

      if (node?.config) {
        const cfg = node.config as { subject?: string; body?: unknown };
        if (cfg.subject) subject = cfg.subject;
        if (cfg.body) bodyHtml = tiptapJsonToBodyHtml(cfg.body);
      }
    }
  }

  const attachments: { filename: string; content: Buffer }[] = [];
  for (const doc of generatedDocs) {
    if (!doc.file_url) continue;
    const res = await fetch(doc.file_url);
    if (!res.ok) continue;
    const baseName = (doc.document_name ?? 'documento').replace(/\.pdf$/i, '');
    attachments.push({ filename: `${baseName}.pdf`, content: Buffer.from(await res.arrayBuffer()) });
  }

  await sendOrgEmail(legalProcess.organization_id, {
    to: toEmail,
    subject,
    bodyHtml,
    attachments,
  });

  await supabase.from('audit_logs').insert({
    organization_id: legalProcess.organization_id,
    user_id: userId,
    action: 'email_sent',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { to: toEmail, subject, attachments_count: attachments.length, email_category: 'documents', source: 'manual_resend' },
  });
}
