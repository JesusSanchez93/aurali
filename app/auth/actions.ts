'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  console.log('aaaa');

  redirect('/auth/login');
}
