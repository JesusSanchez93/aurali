import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { logClientAction } from '@/lib/audit/logClientAction';

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

  // El código OTP se genera y envía desde VerifyOtpForm (vía resendOtpAction)
  // al montar en el navegador real, no acá — este GET puede dispararlo un
  // escáner de enlaces de correo corporativo antes de que el cliente abra el
  // mensaje, lo que enviaría un código que nadie pidió y reiniciaría
  // otp_attempts en cada re-escaneo. Fijar la cookie sí es seguro: es
  // idempotente y solo la usa quien realmente carga la página de verificación.
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
