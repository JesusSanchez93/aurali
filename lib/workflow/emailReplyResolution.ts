import type { SupabaseClient } from '@supabase/supabase-js';
import { resumeWorkflow } from '@/lib/workflow/workflowRunner';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('EMAIL_REPLY_RESOLUTION');

export interface PendingFollowUp {
  id: string;
  organization_id: string;
  legal_process_id: string;
  workflow_run_id: string | null;
  requires_attachments: boolean;
}

export interface InboundReply {
  from: string;
  subject: string;
  text: string | null;
  attachments: { filename: string; contentType: string | null; content: Buffer }[];
}

export interface AttachmentCompletionStatus {
  /** Documentos enviados al cliente que requieren una copia de vuelta (generated_documents, is_preview=false). */
  required: number;
  /** Documentos recibidos por correo y ya aprobados por el abogado (legal_process_email_attachments.status='approved'). */
  approved: number;
  /** true solo cuando hay al menos un documento requerido y todos están aprobados. */
  complete: boolean;
}

/**
 * El nodo wait_email_reply no se da por resuelto con solo recibir UNA
 * respuesta — el cliente puede mandar los documentos en varios correos, o el
 * abogado puede rechazar alguno y pedir que lo reenvíe. Se considera
 * completo únicamente cuando el número de adjuntos APROBADOS por el abogado
 * alcanza el número de documentos que realmente se le pidieron (los
 * generated_documents no-preview enviados en el paso anterior). Usado tanto
 * al llegar una respuesta nueva (resolveEmailReply) como al aprobar un
 * adjunto desde el dashboard (ver legal-process/actions.ts,
 * approveEmailAttachmentAction) — dos disparadores distintos, un solo
 * criterio de "ya está completo".
 */
export async function getAttachmentCompletionStatus(
  supabase: SupabaseClient,
  legalProcessId: string,
): Promise<AttachmentCompletionStatus> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

  const [{ count: required }, { count: approved }] = await Promise.all([
    db.from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('legal_process_id', legalProcessId)
      .eq('is_preview', false) as unknown as Promise<{ count: number | null }>,
    db.from('legal_process_email_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('legal_process_id', legalProcessId)
      .eq('status', 'approved') as unknown as Promise<{ count: number | null }>,
  ]);

  const requiredCount = required ?? 0;
  const approvedCount = approved ?? 0;

  return {
    required: requiredCount,
    approved: approvedCount,
    complete: requiredCount > 0 && approvedCount >= requiredCount,
  };
}

/**
 * Si el conteo ya está completo (ver getAttachmentCompletionStatus), resuelve
 * el email_follow_up 'reply' pendiente más reciente de este proceso y reanuda
 * su workflow — mismo efecto final que resolveEmailReply cuando la respuesta
 * ya trae todo, pero disparado desde la aprobación manual del abogado en vez
 * de la llegada de un correo. No hace nada (y lo deja bien loggeado) si
 * todavía falta algún documento por aprobar, o si no hay un follow-up
 * pendiente que resolver (p. ej. ya se resolvió antes).
 */
export async function tryResolvePendingReplyOnApproval(
  supabase: SupabaseClient,
  legalProcessId: string,
): Promise<{ resolved: boolean; status: AttachmentCompletionStatus }> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

  const status = await getAttachmentCompletionStatus(supabase, legalProcessId);
  logger.info('Conteo de documentos tras aprobación', { legalProcessId, ...status });

  if (!status.complete) {
    logger.info('Todavía faltan documentos por aprobar — el nodo wait_email_reply sigue activo', {
      legalProcessId,
      required: status.required,
      approved: status.approved,
    });
    return { resolved: false, status };
  }

  const { data: followUp } = await db
    .from('email_follow_ups')
    .select('id, workflow_run_id, organization_id')
    .eq('legal_process_id', legalProcessId)
    .eq('resolution_mode', 'reply')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; workflow_run_id: string | null; organization_id: string } | null };

  if (!followUp) {
    logger.info('Documentos completos pero no hay un email_follow_up pendiente que resolver (¿ya se había resuelto?)', {
      legalProcessId,
    });
    return { resolved: false, status };
  }

  const { data: approvedAttachments } = await db
    .from('legal_process_email_attachments')
    .select('id')
    .eq('legal_process_id', legalProcessId)
    .eq('status', 'approved') as { data: { id: string }[] | null };
  const attachmentIds = (approvedAttachments ?? []).map((a) => a.id);

  await db
    .from('email_follow_ups')
    .update({ status: 'received', resolved_at: new Date().toISOString() })
    .eq('id', followUp.id);

  void db.from('audit_logs').insert({
    organization_id: followUp.organization_id,
    action: 'client_email_reply_documents_complete',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: {
      email_follow_up_id: followUp.id,
      required: status.required,
      approved: status.approved,
      attachment_ids: attachmentIds,
    },
  });

  if (followUp.workflow_run_id) {
    try {
      await resumeWorkflow(followUp.workflow_run_id, {
        reply_text: null,
        attachment_ids: attachmentIds,
      });
      logger.info('Workflow reanudado tras completar la aprobación de documentos', {
        legalProcessId,
        workflowRunId: followUp.workflow_run_id,
        approvedCount: attachmentIds.length,
      });
    } catch (err) {
      logger.error('Error al reanudar el workflow tras completar la aprobación', undefined, {
        workflowRunId: followUp.workflow_run_id,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.info('email_follow_up resuelto sin workflow_run_id (seguimiento manual, p. ej. corrección de rechazo)', {
      legalProcessId,
      emailFollowUpId: followUp.id,
    });
  }

  return { resolved: true, status };
}

/**
 * Lo que pasa cuando llega la respuesta de un cliente a un nodo
 * 'wait_email_reply', sin importar CÓMO se detectó (webhook de Resend
 * Inbound, poller IMAP o el push de Gmail — todos llaman esto una vez que
 * tienen el mensaje ya parseado): sube adjuntos, los asocia al proceso y
 * notifica al abogado. El seguimiento SOLO se marca resuelto (y el workflow
 * reanuda) si el conteo de documentos aprobados ya alcanza lo requerido —
 * ver getAttachmentCompletionStatus. Como los adjuntos recién subidos entran
 * en status='pending' (nunca 'approved' automáticamente), en la práctica
 * esto casi siempre deja el nodo esperando la revisión manual del abogado;
 * es tryResolvePendingReplyOnApproval (disparado desde
 * approveEmailAttachmentAction) quien normalmente completa el ciclo.
 * Devuelve `null` si `requires_attachments` está activo y la respuesta no
 * trae nada — en ese caso el llamador NO debe marcar nada como resuelto,
 * sigue esperando.
 */
export async function resolveEmailReply(
  supabase: SupabaseClient,
  followUp: PendingFollowUp,
  reply: InboundReply,
): Promise<{ attachmentIds: string[]; resolved: boolean } | null> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

  logger.info('Procesando respuesta del cliente', {
    followUpId: followUp.id,
    legalProcessId: followUp.legal_process_id,
    from: reply.from,
    subject: reply.subject,
    attachmentsInReply: reply.attachments.length,
    requiresAttachments: followUp.requires_attachments,
  });

  if (followUp.requires_attachments && reply.attachments.length === 0) {
    logger.info('Respuesta sin adjuntos — sigue esperando (requires_attachments activo)', {
      followUpId: followUp.id,
    });
    return null;
  }

  // ── Sube los adjuntos a Storage y los asocia al proceso ───────────────────
  const attachmentIds: string[] = [];
  for (const att of reply.attachments) {
    const storagePath = `${followUp.organization_id}/${followUp.legal_process_id}/email-replies/${Date.now()}-${att.filename}`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, att.content, { contentType: att.contentType ?? undefined, upsert: true });

    if (uploadErr) {
      logger.error('Error al subir adjunto de respuesta', undefined, { filename: att.filename, error: uploadErr.message });
      continue;
    }

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const { data: inserted, error: insertErr } = await db
      .from('legal_process_email_attachments')
      .insert({
        organization_id: followUp.organization_id,
        legal_process_id: followUp.legal_process_id,
        email_follow_up_id: followUp.id,
        filename: att.filename,
        storage_path: storagePath,
        file_url: signed?.signedUrl ?? null,
        content_type: att.contentType,
        size_bytes: att.content.length,
        subject: reply.subject,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (insertErr) {
      logger.error('Error al registrar adjunto de respuesta', undefined, { filename: att.filename, error: insertErr.message });
      continue;
    }
    if (inserted) {
      attachmentIds.push(inserted.id);
      logger.info('Adjunto de respuesta subido y registrado (status=pending, a la espera de revisión)', {
        followUpId: followUp.id,
        attachmentId: inserted.id,
        filename: att.filename,
        sizeBytes: att.content.length,
      });
    }
  }

  logger.info('Adjuntos procesados de esta respuesta', {
    followUpId: followUp.id,
    receivedInReply: reply.attachments.length,
    persisted: attachmentIds.length,
    failed: reply.attachments.length - attachmentIds.length,
  });

  const status = await getAttachmentCompletionStatus(supabase, followUp.legal_process_id);
  logger.info('Conteo de documentos requeridos vs. aprobados tras esta respuesta', {
    followUpId: followUp.id,
    legalProcessId: followUp.legal_process_id,
    ...status,
  });

  // ── Audit log ──────────────────────────────────────────────────────────────
  void db.from('audit_logs').insert({
    organization_id: followUp.organization_id,
    action: 'client_email_reply_received',
    entity: 'legal_process',
    entity_id: followUp.legal_process_id,
    metadata: {
      from: reply.from,
      subject: reply.subject,
      attachment_count: attachmentIds.length,
      email_follow_up_id: followUp.id,
      required_documents: status.required,
      approved_documents: status.approved,
      documents_complete: status.complete,
    },
  });

  // ── Notifica al abogado (mismo mecanismo que executeNotifyLawyer) ────────
  const { data: legalProcess } = await db
    .from('legal_processes')
    .select('lawyer_id')
    .eq('id', followUp.legal_process_id)
    .maybeSingle() as { data: { lawyer_id: string | null } | null };

  if (legalProcess?.lawyer_id) {
    const { data: lawyer } = await db
      .from('profiles')
      .select('email, firstname, lastname')
      .eq('id', legalProcess.lawyer_id)
      .maybeSingle() as { data: { email: string | null; firstname: string | null; lastname: string | null } | null };

    if (lawyer?.email) {
      const name = [lawyer.firstname, lawyer.lastname].filter(Boolean).join(' ') || 'Abogado';
      const attachmentsNote = attachmentIds.length > 0
        ? `<p>Se recibieron ${attachmentIds.length} documento(s) adjunto(s) (pendientes de tu revisión — apruébalos desde el detalle del proceso). Documentos aprobados hasta ahora: ${status.approved}/${status.required || '?'}.</p>`
        : '<p>La respuesta no traía documentos adjuntos.</p>';

      try {
        await sendOrgEmail(followUp.organization_id, {
          to: lawyer.email,
          subject: `El cliente respondió — proceso ${followUp.legal_process_id}`,
          bodyHtml: `<p>Hola <strong>${name}</strong>,</p>
            <p>El cliente respondió el correo de seguimiento.</p>
            ${reply.text ? `<blockquote>${reply.text.replace(/\n/g, '<br>')}</blockquote>` : ''}
            ${attachmentsNote}`,
        });
      } catch (err) {
        logger.error('Error al notificar al abogado', undefined, {
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ── Solo resuelve el seguimiento y reanuda el workflow si el conteo de
  //    documentos aprobados ya alcanza lo requerido — normalmente NO pasará
  //    acá (los adjuntos recién subidos entran en 'pending'), sino en
  //    tryResolvePendingReplyOnApproval cuando el abogado apruebe el último
  //    que faltaba. Se deja el check simétrico por si algún día se auto-
  //    aprueban adjuntos, o requiredDocuments es 0 por datos inconsistentes.
  if (!status.complete) {
    logger.info('Respuesta procesada — el nodo wait_email_reply sigue activo (faltan documentos por aprobar)', {
      followUpId: followUp.id,
      legalProcessId: followUp.legal_process_id,
      required: status.required,
      approved: status.approved,
    });
    return { attachmentIds, resolved: false };
  }

  await db
    .from('email_follow_ups')
    .update({ status: 'received', resolved_at: new Date().toISOString() })
    .eq('id', followUp.id);

  if (followUp.workflow_run_id) {
    try {
      await resumeWorkflow(followUp.workflow_run_id, {
        reply_text: reply.text,
        attachment_ids: attachmentIds,
      });
      logger.info('Documentos completos — workflow reanudado tras la respuesta', {
        followUpId: followUp.id,
        workflowRunId: followUp.workflow_run_id,
        approvedCount: status.approved,
      });
    } catch (err) {
      logger.error('Error al reanudar el workflow tras la respuesta', undefined, {
        workflowRunId: followUp.workflow_run_id,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { attachmentIds, resolved: true };
}
