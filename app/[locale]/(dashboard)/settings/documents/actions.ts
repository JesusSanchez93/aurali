'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

  if (!profile?.current_organization_id) throw new Error('No organization');
  return { supabase, db, userId: user.id, orgId: profile.current_organization_id };
}

// ─── HEADERS ────────────────────────────────────────────────────────────────

export type DocHeader = {
  id: string;
  name: string;
  content: unknown;
  is_default: boolean;
  created_at: string;
};

export async function getDocHeaders(): Promise<DocHeader[]> {
  const { db, orgId } = await getOrgContext();
  const { data, error } = await db
    .from('document_headers')
    .select('id, name, content, is_default, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDocHeader(input: { name: string; content: unknown; is_default: boolean }) {
  const { db, userId, orgId } = await getOrgContext();
  if (input.is_default) {
    await db.from('document_headers').update({ is_default: false }).eq('organization_id', orgId);
  }
  const { error } = await db.from('document_headers').insert({
    name: input.name,
    content: input.content,
    is_default: input.is_default,
    organization_id: orgId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function updateDocHeader(id: string, input: { name: string; content: unknown; is_default: boolean }) {
  const { db, orgId } = await getOrgContext();
  if (input.is_default) {
    await db.from('document_headers').update({ is_default: false }).eq('organization_id', orgId).neq('id', id);
  }
  const { error } = await db
    .from('document_headers')
    .update({ name: input.name, content: input.content, is_default: input.is_default })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteDocHeader(id: string) {
  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('document_headers')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

// ─── FOOTERS ────────────────────────────────────────────────────────────────

export type DocFooter = {
  id: string;
  name: string;
  content: unknown;
  is_default: boolean;
  created_at: string;
};

export async function getDocFooters(): Promise<DocFooter[]> {
  const { db, orgId } = await getOrgContext();
  const { data, error } = await db
    .from('document_footers')
    .select('id, name, content, is_default, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDocFooter(input: { name: string; content: unknown; is_default: boolean }) {
  const { db, userId, orgId } = await getOrgContext();
  if (input.is_default) {
    await db.from('document_footers').update({ is_default: false }).eq('organization_id', orgId);
  }
  const { error } = await db.from('document_footers').insert({
    name: input.name,
    content: input.content,
    is_default: input.is_default,
    organization_id: orgId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function updateDocFooter(id: string, input: { name: string; content: unknown; is_default: boolean }) {
  const { db, orgId } = await getOrgContext();
  if (input.is_default) {
    await db.from('document_footers').update({ is_default: false }).eq('organization_id', orgId).neq('id', id);
  }
  const { error } = await db
    .from('document_footers')
    .update({ name: input.name, content: input.content, is_default: input.is_default })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteDocFooter(id: string) {
  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('document_footers')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}
