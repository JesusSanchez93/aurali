'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateTag } from 'next/cache';

export async function getTemplates() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('legal_templates')
    .select('id, name, document_type, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    throw new Error('Error loading templates');
  }

  return data;
}

export async function createFormat(data: { name: string }) {
  await fetch(`${process.env.API_URL}/formats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  revalidateTag('formats', 'page');
}
