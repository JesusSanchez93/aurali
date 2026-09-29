'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ProcessComment {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  author_name: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user || error) throw new Error('Unauthorized');
  return { supabase, user };
}

function authorName(profile: { firstname: string | null; lastname: string | null } | null | undefined) {
  return [profile?.firstname, profile?.lastname].filter(Boolean).join(' ') || 'Usuario';
}

/**
 * Comentarios libres del proceso, más antiguo primero — como en Trello, el
 * feed se lee de arriba (más viejo) a abajo (más nuevo), con el input para
 * agregar uno nuevo por separado en el modal.
 */
export async function getProcessComments(legalProcessId: string): Promise<ProcessComment[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('legal_process_comments')
    .select('id, body, created_at, created_by, profiles(firstname, lastname)')
    .eq('legal_process_id', legalProcessId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      created_by: c.created_by,
      author_name: authorName(profile),
    };
  });
}

export async function addProcessComment(legalProcessId: string, body: string): Promise<ProcessComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('El comentario no puede estar vacío');

  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id, firstname, lastname')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('legal_process_comments')
    .insert({
      organization_id: profile.current_organization_id,
      legal_process_id: legalProcessId,
      created_by: user.id,
      body: trimmed,
    })
    .select('id, body, created_at, created_by')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'No se pudo agregar el comentario');

  // También queda en el Historial del proceso (audit_logs), no solo en el
  // feed de comentarios — el pedido explícito fue que el Historial registre
  // la interacción del tablero, comentarios incluidos. Con await, no con
  // void/fire-and-forget: en un server action la conexión puede cerrarse
  // antes de que una promesa no esperada termine, y el insert nunca llega
  // a ejecutarse (confirmado: pasaba justo eso).
  await supabase.from('audit_logs').insert({
    organization_id: profile.current_organization_id,
    user_id: user.id,
    action: 'comment_added',
    entity: 'legal_process',
    entity_id: legalProcessId,
    metadata: { preview: trimmed.slice(0, 120) },
  });

  revalidatePath('/board');

  return { ...data, author_name: authorName(profile) };
}

export async function deleteProcessComment(commentId: string): Promise<void> {
  const { supabase } = await requireUser();

  const { error } = await supabase.from('legal_process_comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);

  revalidatePath('/board');
}
