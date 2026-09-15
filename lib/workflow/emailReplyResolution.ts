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

/**
 * Lo que pasa cuando llega la respuesta de un cliente a un nodo
 * 'wait_email_reply', sin importar CÓMO se detectó (webhook de Resend
 * Inbound o poller IMAP — ambos llaman esto una vez que tienen el mensaje
 * ya parseado): sube adjuntos, los asocia al proceso, notifica al abogado,
 * marca el seguimiento resuelto y reanuda el workflow. Devuelve `null` si
 * `requires_attachments` está activo y la respuesta no trae nada — en ese
 * caso el llamador NO debe marcar nada como resuelto, sigue esperando.
 */
export async function resolveEmailReply(
  supabase: SupabaseClient,
  followUp: PendingFollowUp,
  reply: InboundReply,
): Promise<{ attachmentIds: string[] } | null> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

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
    if (inserted) attachmentIds.push(inserted.id);
  }

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
        ? `<p>Se recibieron ${attachmentIds.length} documento(s) adjunto(s), ya asociados al proceso.</p>`
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

  // ── Resuelve el seguimiento y reanuda el workflow ─────────────────────────
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
    } catch (err) {
      logger.error('Error al reanudar el workflow tras la respuesta', undefined, {
        workflowRunId: followUp.workflow_run_id,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { attachmentIds };
}
