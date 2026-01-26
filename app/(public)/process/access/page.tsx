import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export default async function EntryPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const cookieStore = await cookies();

  const token = searchParams.token;
  if (!token) redirect('/link-invalido');

  const supabase = await createClient();

  const { data: process } = await supabase
    .from('legal_processes')
    .select('id')
    .eq('access_token', token)
    .eq('access_token_used', false)
    .gt('access_token_expires_at', new Date().toISOString())
    .single();

  if (!process) redirect('/link-invalido');

  await supabase
    .from('legal_processes')
    .update({
      access_token_used: true,
      access_token_used_at: new Date().toISOString(),
    })
    .eq('id', process.id);

  cookieStore.set('legal_process_session', process.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 30,
    path: '/',
  });

  redirect('/process/complete');
}
