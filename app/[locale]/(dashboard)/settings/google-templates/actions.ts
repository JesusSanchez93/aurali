'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getValidAccessToken } from '@/lib/google/auth';
import { validateGoogleDocMimeType } from '@/lib/google/googleDocPdfService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function getOrgContext() {
  const supabase = await createClient();
  const db = supabase as DB;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Sin organización activa');
  return { supabase, db, userId: user.id, orgId: profile.current_organization_id as string };
}

export type GoogleDocTemplate = {
  id: string;
  name: string;
  google_doc_id: string;
  description: string | null;
  created_at: string;
};

export type GoogleConnectionStatus = {
  connected: boolean;
  email: string | null;
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getGoogleDocTemplates(): Promise<GoogleDocTemplate[]> {
  const { db, orgId } = await getOrgContext();
  const { data, error } = await db
    .from('google_doc_templates')
    .select('id, name, google_doc_id, description, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const { db, userId } = await getOrgContext();
  const { data } = await db
    .from('google_oauth_tokens')
    .select('google_email')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    connected: !!data,
    email: data?.google_email ?? null,
  };
}

// ─── Write ─────────────────────────────────────────────────────────────────────

function extractDocId(input: string): string {
  // Soporta URL completa o solo el ID
  const match = input.match(/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Si es un ID puro (sin slashes)
  if (/^[a-zA-Z0-9_-]+$/.test(input.trim())) return input.trim();
  throw new Error(
    'URL de Google Doc inválida. Copia el enlace directo desde Google Docs (Compartir → Copiar enlace).',
  );
}

export async function createGoogleDocTemplate(input: {
  name: string;
  googleDocUrl: string;
  description?: string;
}) {
  const googleDocId = extractDocId(input.googleDocUrl);
  const { db, userId, orgId } = await getOrgContext();
  const accessToken = await getValidAccessToken(userId);
  await validateGoogleDocMimeType(googleDocId, accessToken);
  const { error } = await db.from('google_doc_templates').insert({
    name: input.name,
    google_doc_id: googleDocId,
    description: input.description ?? null,
    organization_id: orgId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function updateGoogleDocTemplate(
  id: string,
  input: { name: string; googleDocUrl: string; description?: string },
) {
  const googleDocId = extractDocId(input.googleDocUrl);
  const { db, userId, orgId } = await getOrgContext();
  const accessToken = await getValidAccessToken(userId);
  await validateGoogleDocMimeType(googleDocId, accessToken);
  const { error } = await db
    .from('google_doc_templates')
    .update({
      name: input.name,
      google_doc_id: googleDocId,
      description: input.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteGoogleDocTemplate(id: string) {
  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('google_doc_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}
