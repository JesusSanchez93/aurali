import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/404', request.url));
  }

  const supabase = await createClient();

  const { data: process, error } = await supabase
    .from('legal_processes')
    .select('access_token_used, access_token_expires_at, id')
    .eq('access_token', token)
    .eq('access_token_used', false)
    .gt('access_token_expires_at', new Date().toISOString())
    .single();
    
  if (
    error ||
    !process ||
    process.access_token_used ||
    new Date(process.access_token_expires_at) < new Date()
  ) {
    return NextResponse.redirect(new URL('/link-expired', request.url));
  }

  const cookieStore = await cookies();
  
   cookieStore.set({
    name: "legal_process_token",
    value: token,
    httpOnly: true,
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.redirect(
    new URL(`/process/complete/${process.id}`, request.url)
  );
}
