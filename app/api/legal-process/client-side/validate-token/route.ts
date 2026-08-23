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

  const supabase = await createClient();

  // Fetched WITHOUT the access_token_used/expires_at filters (unlike the actual
  // validity check below) so a found-but-invalid row can still be identified and
  // logged — this is what lets staff tell "expired link" apart from "garbage/bot
  // token that matches nothing" when a client reports the link doesn't work.
  const { data: process, error } = await supabase
    .from('legal_processes')
    .select('access_token_used, access_token_expires_at, id, status')
    .eq('access_token', token)
    .single();

  if (
    error ||
    !process ||
    process.access_token_used ||
    (process?.access_token_expires_at && new Date(process.access_token_expires_at) < new Date())
  ) {
    if (process?.id) {
      await logClientAction({
        legalProcessId: process.id,
        action: 'client_form_link_invalid',
        metadata: {
          reason: process.access_token_used ? 'already_used' : 'expired',
        },
      });
    }
    return NextResponse.redirect(new URL('/link-expired', request.url));
  }

  // Form is only open while the process is awaiting client data
  if (!['draft', 'form_sent'].includes(process.status)) {
    await logClientAction({
      legalProcessId: process.id,
      action: 'client_form_link_invalid',
      metadata: { reason: 'process_status_not_open', status: process.status },
    });
    return NextResponse.redirect(new URL('/legal-process/form-unavailable', request.url));
  }

  await supabase
    .from('legal_processes')
    .update({ access_token_used: true })
    .eq('access_token', token);

  const cookieStore = await cookies();

  cookieStore.set({
    name: "legal_process_token",
    value: token,
    httpOnly: true,
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24, //24horas
  });

  await logClientAction({
    legalProcessId: process.id,
    action: 'client_form_link_opened',
  });

  return NextResponse.redirect(
    new URL(`/legal-process/client-side/${process.id}`, request.url)
  );
}
