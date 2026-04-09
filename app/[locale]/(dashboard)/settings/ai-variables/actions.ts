'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { validatePromptServer } from '@/lib/ai-variables/validate-prompt';

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

export type AiVariable = {
  id: string;
  name: string;
  key: string;
  prompt: string;
  description: string | null;
  examples: string[];
  created_at: string;
};

export async function getAiVariables(): Promise<AiVariable[]> {
  const { db, orgId } = await getOrgContext();
  const { data, error } = await db
    .from('ai_variables')
    .select('id, name, key, prompt, description, examples, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((v: AiVariable & { examples: string[] | null }) => ({
    ...v,
    examples: v.examples ?? [],
  }));
}

export async function createAiVariable(input: {
  name: string;
  key: string;
  prompt: string;
  description?: string;
  examples?: string[];
}) {
  const validation = validatePromptServer(input.prompt);
  if (!validation.valid) throw new Error(validation.error);

  const { db, userId, orgId } = await getOrgContext();
  const { error } = await db.from('ai_variables').insert({
    name: input.name,
    key: input.key,
    prompt: input.prompt,
    description: input.description ?? null,
    examples: input.examples ?? [],
    organization_id: orgId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function updateAiVariable(
  id: string,
  input: { name: string; key: string; prompt: string; description?: string; examples?: string[] },
) {
  const validation = validatePromptServer(input.prompt);
  if (!validation.valid) throw new Error(validation.error);

  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('ai_variables')
    .update({
      name: input.name,
      key: input.key,
      prompt: input.prompt,
      description: input.description ?? null,
      examples: input.examples ?? [],
    })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteAiVariable(id: string) {
  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('ai_variables')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}
