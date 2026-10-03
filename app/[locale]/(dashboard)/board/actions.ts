'use server';

import { requireOrgContext, revalidateBoards, type OrgContext } from '@/lib/board/org-context';

export interface BoardSummary {
  id: string;
  name: string;
  workflow_template_id: string | null;
  workflow_template_name: string | null;
  created_at: string;
  columns: { id: string; name: string; count: number }[];
  total: number;
}

export interface ProcessTypeOption {
  id: string;
  name: string;
}

const LINKED_COLUMNS = [
  { name: 'Nuevos', is_finished: false },
  { name: 'En curso', is_finished: false },
  { name: 'Finalizados', is_finished: true },
];

const FREE_COLUMNS = [
  { name: 'Por hacer', is_finished: false },
  { name: 'En curso', is_finished: false },
  { name: 'Hecho', is_finished: false },
];

export async function listBoards(): Promise<BoardSummary[]> {
  const { supabase, organizationId } = await requireOrgContext();

  const { data: boards } = await supabase
    .from('boards')
    .select('id, name, workflow_template_id, created_at, workflow_templates(name), legal_process_board_columns(id, name, position)')
    .eq('organization_id', organizationId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (!boards?.length) return [];

  const columnIds = boards.flatMap((b) => b.legal_process_board_columns.map((c) => c.id));
  const [{ data: processes }, { data: tasks }] = await Promise.all([
    supabase.from('legal_processes').select('board_column_id').in('board_column_id', columnIds),
    supabase.from('board_cards').select('column_id').in('column_id', columnIds),
  ]);

  const countByColumn = new Map<string, number>();
  for (const row of processes ?? []) {
    if (row.board_column_id) countByColumn.set(row.board_column_id, (countByColumn.get(row.board_column_id) ?? 0) + 1);
  }
  for (const row of tasks ?? []) {
    countByColumn.set(row.column_id, (countByColumn.get(row.column_id) ?? 0) + 1);
  }

  return boards.map((board) => {
    const columns = [...board.legal_process_board_columns]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name, count: countByColumn.get(c.id) ?? 0 }));
    return {
      id: board.id,
      name: board.name,
      workflow_template_id: board.workflow_template_id,
      workflow_template_name: board.workflow_templates?.name ?? null,
      created_at: board.created_at,
      columns,
      total: columns.reduce((sum, c) => sum + c.count, 0),
    };
  });
}

async function activeProcessTypes({ supabase, organizationId }: OrgContext): Promise<ProcessTypeOption[]> {
  const { data } = await supabase
    .from('organization_workflows')
    .select('workflow_template_id, workflow_templates(name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  return (data ?? []).map((row) => ({
    id: row.workflow_template_id,
    name: row.workflow_templates?.name ?? 'Proceso legal',
  }));
}

/** Tipos de proceso activos que todavía no tienen tablero (máximo uno por tipo). */
export async function getAvailableProcessTypes(): Promise<ProcessTypeOption[]> {
  const ctx = await requireOrgContext();
  const [types, { data: linked }] = await Promise.all([
    activeProcessTypes(ctx),
    ctx.supabase
      .from('boards')
      .select('workflow_template_id')
      .eq('organization_id', ctx.organizationId)
      .not('workflow_template_id', 'is', null),
  ]);
  const taken = new Set((linked ?? []).map((b) => b.workflow_template_id));
  return types.filter((type) => !taken.has(type.id));
}

export async function createBoard(input: { name: string; workflowTemplateId: string | null }): Promise<string> {
  const ctx = await requireOrgContext();
  const { supabase, organizationId, userId } = ctx;

  const name = input.name.trim();
  if (!name) throw new Error('El nombre del tablero no puede estar vacío');
  if (name.length > 80) throw new Error('El nombre del tablero es demasiado largo');

  if (input.workflowTemplateId) {
    const available = await getAvailableProcessTypes();
    if (!available.some((type) => type.id === input.workflowTemplateId)) {
      throw new Error('Ese proceso legal ya tiene un tablero o no está activo');
    }
  }

  const { count } = await supabase
    .from('boards')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  const { data: board, error } = await supabase
    .from('boards')
    .insert({
      organization_id: organizationId,
      workflow_template_id: input.workflowTemplateId,
      created_by: userId,
      name,
      position: count ?? 0,
    })
    .select('id')
    .single();

  if (error || !board) {
    throw new Error(error?.code === '23505' ? 'Ese proceso legal ya tiene un tablero' : (error?.message ?? 'No se pudo crear el tablero'));
  }

  const columns = input.workflowTemplateId ? LINKED_COLUMNS : FREE_COLUMNS;
  const { error: columnsError } = await supabase.from('legal_process_board_columns').insert(
    columns.map((column, position) => ({
      organization_id: organizationId,
      board_id: board.id,
      name: column.name,
      position,
      is_finished: column.is_finished,
      is_default: false,
    })),
  );
  if (columnsError) throw new Error(columnsError.message);

  if (input.workflowTemplateId) {
    const { error: syncError } = await supabase.rpc('sync_board_processes', { p_board_id: board.id });
    if (syncError) throw new Error(syncError.message);
  }

  revalidateBoards();
  return board.id;
}

export async function renameBoard(boardId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre del tablero no puede estar vacío');
  const { supabase, organizationId } = await requireOrgContext();

  const { error } = await supabase
    .from('boards')
    .update({ name: trimmed.slice(0, 80), updated_at: new Date().toISOString() })
    .eq('id', boardId)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  revalidateBoards();
}

/**
 * Borra el tablero con sus columnas y tarjetas a mano. Los procesos de un
 * tablero amarrado no se borran: solo salen del tablero. Solo administradores (RLS).
 */
export async function deleteBoard(boardId: string): Promise<void> {
  const { supabase, organizationId } = await requireOrgContext();

  const { data, error } = await supabase
    .from('boards')
    .delete()
    .eq('id', boardId)
    .eq('organization_id', organizationId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Solo un administrador puede eliminar tableros');
  revalidateBoards();
}

// ── Tarjetas a mano (tableros libres) ──────────────────────────────────────

export interface TaskCardComment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
}

export interface TaskCardDetail {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  creator_name: string | null;
  comments: TaskCardComment[];
}

export interface OrgMemberOption {
  id: string;
  name: string;
}

const fullName = (p: { firstname: string | null; lastname: string | null; email?: string | null } | null) =>
  [p?.firstname, p?.lastname].filter(Boolean).join(' ') || p?.email || 'Sin nombre';

export async function createTaskCard(columnId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('El título no puede estar vacío');
  const { supabase, organizationId, userId } = await requireOrgContext();

  const { data: column } = await supabase
    .from('legal_process_board_columns')
    .select('board_id')
    .eq('id', columnId)
    .single();
  if (!column?.board_id) throw new Error('Columna no encontrada');

  const { data: last } = await supabase
    .from('board_cards')
    .select('position')
    .eq('column_id', columnId)
    .order('position', { ascending: false })
    .limit(1);

  const { data, error } = await supabase
    .from('board_cards')
    .insert({
      organization_id: organizationId,
      board_id: column.board_id,
      column_id: columnId,
      created_by: userId,
      title: trimmed.slice(0, 200),
      position: (last?.[0]?.position ?? -1) + 1,
    })
    .select('id, title, description, due_date, assigned_to, column_id, position')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la tarjeta');
  revalidateBoards();
  return { ...data, assignee_name: null, comments_count: 0 };
}

export async function updateTaskCard(
  cardId: string,
  fields: { title?: string; description?: string | null; due_date?: string | null; assigned_to?: string | null },
): Promise<void> {
  const { supabase } = await requireOrgContext();

  const update: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (!title) throw new Error('El título no puede estar vacío');
    update.title = title.slice(0, 200);
  }
  if (fields.description !== undefined) update.description = fields.description?.trim() ? fields.description.slice(0, 5000) : null;
  if (fields.due_date !== undefined) update.due_date = fields.due_date || null;
  if (fields.assigned_to !== undefined) update.assigned_to = fields.assigned_to || null;

  const { error } = await supabase.from('board_cards').update(update).eq('id', cardId);
  if (error) throw new Error(error.message);
  revalidateBoards();
}

export async function deleteTaskCard(cardId: string): Promise<void> {
  const { supabase } = await requireOrgContext();
  const { data, error } = await supabase.from('board_cards').delete().eq('id', cardId).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Solo quien creó la tarjeta o un administrador puede eliminarla');
  revalidateBoards();
}

/** Orden final de una columna tras un drag & drop (incluye la tarjeta soltada ahí). */
export async function reorderTaskCards(columnId: string, orderedCardIds: string[]): Promise<void> {
  const { supabase } = await requireOrgContext();
  const results = await Promise.all(
    orderedCardIds.map((id, index) =>
      supabase.from('board_cards').update({ column_id: columnId, position: index }).eq('id', id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidateBoards();
}

export async function getTaskCardDetail(cardId: string): Promise<TaskCardDetail> {
  const { supabase } = await requireOrgContext();

  const [{ data: card }, { data: comments }] = await Promise.all([
    supabase
      .from('board_cards')
      .select('id, title, description, due_date, assigned_to, created_at, creator:profiles!board_cards_created_by_fkey(firstname, lastname, email)')
      .eq('id', cardId)
      .single(),
    supabase
      .from('board_card_comments')
      .select('id, body, created_at, author:profiles!board_card_comments_created_by_fkey(firstname, lastname, email)')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true }),
  ]);

  if (!card) throw new Error('Tarjeta no encontrada');

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    due_date: card.due_date,
    assigned_to: card.assigned_to,
    created_at: card.created_at,
    creator_name: card.creator ? fullName(card.creator) : null,
    comments: (comments ?? []).map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author_name: fullName(c.author) })),
  };
}

export async function addTaskCardComment(cardId: string, body: string): Promise<TaskCardComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('El comentario no puede estar vacío');
  const { supabase, organizationId, userId } = await requireOrgContext();

  const { data, error } = await supabase
    .from('board_card_comments')
    .insert({ organization_id: organizationId, card_id: cardId, created_by: userId, body: trimmed.slice(0, 5000) })
    .select('id, body, created_at, author:profiles!board_card_comments_created_by_fkey(firstname, lastname, email)')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'No se pudo enviar el comentario');
  revalidateBoards();
  return { id: data.id, body: data.body, created_at: data.created_at, author_name: fullName(data.author) };
}

/** Miembros activos de la organización, para asignar responsables. */
export async function getBoardMembers(): Promise<OrgMemberOption[]> {
  const { supabase, organizationId } = await requireOrgContext();
  const { data } = await supabase
    .from('organization_members')
    .select('user_id, profiles(firstname, lastname, email)')
    .eq('organization_id', organizationId)
    .eq('active', true);

  return (data ?? [])
    .map((m) => ({ id: m.user_id, name: fullName(m.profiles) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
