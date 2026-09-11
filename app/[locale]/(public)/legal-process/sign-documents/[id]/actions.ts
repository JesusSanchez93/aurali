'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { logClientAction } from '@/lib/audit/logClientAction';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';

const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

type SignatureRequestRow = {
  id: string;
  legal_process_id: string;
  organization_id: string;
  client_email: string;
  access_token: string;
  status: string;
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
};

async function loadRequest(requestId: string): Promise<SignatureRequestRow | null> {
  const supabase = await createClient({ admin: true });
  const { data } = await supabase
    .from('document_signature_requests')
    .select('id, legal_process_id, organization_id, client_email, access_token, status, otp_code_hash, otp_expires_at, otp_attempts')
    .eq('id', requestId)
    .single();
  return data as SignatureRequestRow | null;
}

/** Server-side view for the verify page — confirms the pre-verification cookie matches this request. */
export async function getVerifyPageState(requestId: string): Promise<
  | { ok: true; clientEmail: string }
  | { ok: false; reason: 'not_found' | 'no_access' | 'already_reviewed' }
> {
  const request = await loadRequest(requestId);
  if (!request) return { ok: false, reason: 'not_found' };
  // The link has no time-based/single-use expiry — it stays valid (re-runs the
  // OTP step on every visit) until every document has been approved.
  if (request.status === 'approved') return { ok: false, reason: 'already_reviewed' };

  const cookieStore = await cookies();
  const token = cookieStore.get('signature_request_token')?.value;
  if (!token || token !== request.access_token) return { ok: false, reason: 'no_access' };

  return { ok: true, clientEmail: request.client_email };
}

/** Server-side view for the upload page — confirms the post-verification session cookie matches this request. */
export async function getUploadPageState(requestId: string): Promise<
  | { ok: true; status: string; items: { id: string; document_name: string; original_file_url: string | null; status: string; rejection_reason: string | null }[] }
  | { ok: false; reason: 'not_found' | 'no_access' | 'already_reviewed' }
> {
  const request = await loadRequest(requestId);
  if (!request) return { ok: false, reason: 'not_found' };
  if (request.status === 'approved') return { ok: false, reason: 'already_reviewed' };

  const cookieStore = await cookies();
  const session = cookieStore.get('signature_request_session')?.value;
  if (!session || session !== request.access_token) return { ok: false, reason: 'no_access' };

  const supabase = await createClient({ admin: true });
  const { data: items } = await supabase
    .from('document_signature_items')
    .select('id, document_name, original_file_url, status, rejection_reason')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  return { ok: true, status: request.status, items: items ?? [] };
}

export async function verifyOtpAction(
  requestId: string,
  code: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const request = await loadRequest(requestId);
  if (!request) return { success: false, error: 'Solicitud no encontrada' };
  if (request.status === 'approved') {
    return { success: false, error: 'Estos documentos ya fueron revisados' };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('signature_request_token')?.value;
  if (!token || token !== request.access_token) {
    return { success: false, error: 'Sesión inválida, abre el enlace del correo nuevamente' };
  }

  if (!request.otp_code_hash || !request.otp_expires_at) {
    return { success: false, error: 'No hay un código activo, solicita uno nuevo' };
  }

  if (request.otp_attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, error: 'Demasiados intentos. Solicita un nuevo código.' };
  }

  const supabase = await createClient({ admin: true });

  if (new Date(request.otp_expires_at) < new Date()) {
    return { success: false, error: 'El código venció, solicita uno nuevo' };
  }

  if (!verifyOtpCode(code, request.otp_code_hash)) {
    await supabase
      .from('document_signature_requests')
      .update({ otp_attempts: request.otp_attempts + 1 })
      .eq('id', requestId);
    return { success: false, error: 'Código incorrecto' };
  }

  await supabase
    .from('document_signature_requests')
    .update({ status: 'verified', otp_verified_at: new Date().toISOString() })
    .eq('id', requestId);

  const store = await cookies();
  store.set({
    name: 'signature_request_session',
    value: request.access_token,
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours to complete the upload
  });
  store.delete('signature_request_token');

  await logClientAction({
    legalProcessId: request.legal_process_id,
    action: 'signature_otp_verified',
    metadata: { signature_request_id: request.id },
  });

  return { success: true };
}

export async function resendOtpAction(requestId: string): Promise<{ success: true } | { success: false; error: string }> {
  const request = await loadRequest(requestId);
  if (!request) return { success: false, error: 'Solicitud no encontrada' };
  if (request.status === 'approved') {
    return { success: false, error: 'Estos documentos ya fueron revisados' };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('signature_request_token')?.value;
  if (!token || token !== request.access_token) {
    return { success: false, error: 'Sesión inválida, abre el enlace del correo nuevamente' };
  }

  if (request.otp_expires_at) {
    const lastSentAt = new Date(request.otp_expires_at).getTime() - 10 * 60 * 1000;
    if (Date.now() - lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      return { success: false, error: 'Espera unos segundos antes de solicitar otro código' };
    }
  }

  const supabase = await createClient({ admin: true });
  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  await supabase
    .from('document_signature_requests')
    .update({ otp_code_hash: hashOtpCode(code), otp_expires_at: otpExpiresAt, otp_attempts: 0, status: 'otp_sent' })
    .eq('id', requestId);

  await sendOrgEmail(request.organization_id, {
    to: request.client_email,
    subject: 'Código de verificación para firmar sus documentos',
    bodyHtml: `<p>Su nuevo código de verificación es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>Este código vence en 10 minutos.</p>`,
  });

  return { success: true };
}

/**
 * Uploads whichever signed documents the client attached in this submission —
 * not necessarily all of them. The client may sign and upload one document
 * now and come back for the rest later, so this only requires at least one
 * file to be present rather than every uploadable item.
 */
export async function uploadSignedDocumentsAction(
  requestId: string,
  formData: FormData,
): Promise<{ success: true; uploadedItemIds: string[]; allDone: boolean } | { success: false; error: string }> {
  const request = await loadRequest(requestId);
  if (!request) return { success: false, error: 'Solicitud no encontrada' };

  const cookieStore = await cookies();
  const session = cookieStore.get('signature_request_session')?.value;
  if (!session || session !== request.access_token) {
    return { success: false, error: 'Sesión inválida, abre el enlace del correo nuevamente' };
  }
  if (request.status === 'approved') {
    return { success: false, error: 'Esta solicitud ya no acepta documentos' };
  }

  const supabase = await createClient({ admin: true });
  const { data: items } = await supabase
    .from('document_signature_items')
    .select('id, status')
    .eq('request_id', requestId);

  const uploadable = (items ?? []).filter((i) => i.status === 'pending' || i.status === 'rejected');
  if (uploadable.length === 0) {
    return { success: false, error: 'No hay documentos pendientes de subir' };
  }

  const itemsWithFile = uploadable.filter((item) => {
    const file = formData.get(`file_${item.id}`) as File | null;
    return !!file && file.size > 0;
  });
  if (itemsWithFile.length === 0) {
    return { success: false, error: 'Selecciona al menos un documento para subir' };
  }

  for (const item of itemsWithFile) {
    const file = formData.get(`file_${item.id}`) as File;
    const storagePath = `${request.organization_id}/${request.legal_process_id}/signed/${Date.now()}-${item.id}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) return { success: false, error: `Error al subir archivo: ${uploadErr.message}` };

    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    await supabase
      .from('document_signature_items')
      .update({
        signed_file_url: signed?.signedUrl ?? null,
        signed_storage_path: storagePath,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', item.id);
  }

  // Only flip the request itself to "uploaded" once every document has been
  // submitted — a partial batch leaves it as-is so the portal keeps accepting
  // the remaining documents on a later visit.
  const remaining = uploadable.length - itemsWithFile.length;
  const allDone = remaining === 0;
  if (allDone) {
    await supabase.from('document_signature_requests').update({ status: 'uploaded' }).eq('id', requestId);
  }

  await logClientAction({
    legalProcessId: request.legal_process_id,
    action: 'signature_documents_uploaded',
    metadata: { signature_request_id: request.id, uploaded_count: itemsWithFile.length, remaining_count: remaining },
  });

  // Best-effort internal notification — never blocks the client's upload.
  try {
    const { data: lawyer } = await supabase
      .from('legal_processes')
      .select('lawyer_id, profiles:lawyer_id(email, firstname)')
      .eq('id', request.legal_process_id)
      .single() as { data: { lawyer_id: string | null; profiles: { email: string | null; firstname: string | null } | null } | null };

    if (lawyer?.profiles?.email) {
      const pendingNote = allDone ? '' : ` Quedan ${remaining} documento(s) pendientes de subir.`;
      await sendOrgEmail(request.organization_id, {
        to: lawyer.profiles.email,
        subject: 'El cliente subió sus documentos firmados',
        bodyHtml: `<p>Hola ${lawyer.profiles.firstname ?? ''},</p><p>El cliente subió ${itemsWithFile.length} documento(s) firmado(s) para revisión.${pendingNote}</p>`,
      });
    }
  } catch {
    // best-effort only
  }

  return { success: true, uploadedItemIds: itemsWithFile.map((i) => i.id), allDone };
}
