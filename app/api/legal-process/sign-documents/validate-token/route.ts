import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { logClientAction } from '@/lib/audit/logClientAction';
import { generateOtpCode, hashOtpCode } from '@/lib/auth/otp';
import { sendOrgEmail } from '@/lib/email/sendOrgEmail';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/404', request.url));
  }

  // Admin client: this route runs unauthenticated (the client has no Supabase
  // session) and needs to write the OTP hash, which is locked down from the
  // anon/authenticated roles at the column level (see the signature-requests
  // migration) — mirrors the client-side validate-token route's use of the
  // service-role client for the equivalent legal_processes write.
  const supabase = await createClient({ admin: true });

  const { data: signatureRequest, error } = await supabase
    .from('document_signature_requests')
    .select('id, legal_process_id, organization_id, client_email, status')
    .eq('access_token', token)
    .single();

  if (error || !signatureRequest) {
    return NextResponse.redirect(new URL('/link-expired', request.url));
  }

  // The link carries no time-based or single-use expiry — the OTP sent on every
  // visit is the only access control. It stays reusable until every document in
  // the request has been approved, at which point there's nothing left to sign.
  if (signatureRequest.status === 'approved') {
    await logClientAction({
      legalProcessId: signatureRequest.legal_process_id,
      action: 'signature_link_invalid',
      metadata: { reason: 'already_approved' },
    });
    return NextResponse.redirect(new URL('/legal-process/form-unavailable', request.url));
  }

  // ── Generate and send the OTP code ─────────────────────────────────────────
  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString(); // 10 minutes

  await supabase
    .from('document_signature_requests')
    .update({
      otp_code_hash: hashOtpCode(code),
      otp_expires_at: otpExpiresAt,
      otp_attempts: 0,
      status: 'otp_sent',
    })
    .eq('id', signatureRequest.id);

  await sendOrgEmail(signatureRequest.organization_id, {
    to: signatureRequest.client_email,
    subject: 'Código de verificación para firmar sus documentos',
    bodyHtml: `<p>Su código de verificación es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>Este código vence en 10 minutos. Si no solicitó este código, ignore este correo.</p>`,
  });

  const cookieStore = await cookies();
  cookieStore.set({
    name: 'signature_request_token',
    value: token,
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 60 * 15, // 15 minutes — just enough to complete the OTP step
  });

  await logClientAction({
    legalProcessId: signatureRequest.legal_process_id,
    action: 'signature_link_opened',
    metadata: { signature_request_id: signatureRequest.id },
  });

  return NextResponse.redirect(
    new URL(`/legal-process/sign-documents/${signatureRequest.id}/verify`, request.url),
  );
}
