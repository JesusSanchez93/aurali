'use server';

import { requireOrgContext, revalidateBoards } from '@/lib/board/org-context';
import { resolveFieldOptions } from '@/lib/forms/catalogOptions';
import { signFormResponsePath } from '@/lib/forms/resolveFormResponseFileUrls';
import { summarizeLast4Digits } from '@/lib/forms/financialProduct';
import type { FormSchema, FinancialProductValue } from '@/lib/forms/types';

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  /** Columna "Finalizados" de un tablero amarrado: no se borra. */
  is_finished: boolean;
}

export interface BoardInfo {
  id: string;
  name: string;
  /** NULL = tablero libre (tarjetas a mano). */
  workflow_template_id: string | null;
  workflow_template_name: string | null;
}

/** Tarjeta creada a mano en un tablero libre. */
export interface TaskCard {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  comments_count: number;
  column_id: string;
  position: number;
}

export interface BoardCard {
  id: string;
  process_number: number;
  status: string;
  client_name: string;
  document_number: string | null;
  created_at: string;
  board_column_id: string;
  board_position: number;
}

export interface BoardData {
  board: BoardInfo;
  columns: BoardColumn[];
  /** Procesos (tablero amarrado). */
  cards: BoardCard[];
  /** Tarjetas a mano (tablero libre). */
  tasks: TaskCard[];
}

export interface BoardCardDescriptionField {
  label: string;
  value: string;
}

export interface BoardCardDescriptionSection {
  title: string;
  fields: BoardCardDescriptionField[];
}

export interface BoardCardDetail {
  id: string;
  process_number: number;
  status: string;
  document_number: string | null;
  created_at: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  /**
   * Lado izquierdo de la tarjeta estilo Trello — todo lo que se sabe del
   * caso, agrupado por sección. Se arma con DOS fuentes porque, según en qué
   * momento se creó el proceso, la info puede vivir en una u otra (ver
   * mergeDynamicFormResponses en lib/workflow/nodeExecutors.ts, mismo
   * problema): legal_process_banks es el flujo legado (siempre una sola
   * sección "Caso"), legal_process_form_responses es el Dynamic Form
   * Builder actual (una sección por cada parte del formulario). Se muestran
   * ambas si existen — no se pierde nada.
   */
  description: BoardCardDescriptionSection[];
  documents: BoardCardDocument[];
}

export interface BoardCardDocument {
  id: string;
  name: string;
  url: string;
  kind: 'generated' | 'received';
}

function revalidateBoard() {
  revalidateBoards();
}

/**
 * Datos de un tablero. Amarrado a un tipo de proceso: las tarjetas son los
 * procesos de ese tipo (sync_board_processes ubica los que falten). Libre:
 * las tarjetas son board_cards creadas a mano.
 */
export async function getBoardData(boardId: string): Promise<BoardData | null> {
  const { supabase, organizationId } = await requireOrgContext();

  const { data: board } = await supabase
    .from('boards')
    .select('id, name, workflow_template_id, workflow_templates(name)')
    .eq('id', boardId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!board) return null;

  if (board.workflow_template_id) {
    const { error } = await supabase.rpc('sync_board_processes', { p_board_id: board.id });
    if (error) console.warn('[getBoardData] sync_board_processes', error.message);
  }

  const { data: columns } = await supabase
    .from('legal_process_board_columns')
    .select('id, name, position, is_finished')
    .eq('board_id', board.id)
    .order('position', { ascending: true });

  const columnIds = (columns ?? []).map((c) => c.id);
  const info: BoardInfo = {
    id: board.id,
    name: board.name,
    workflow_template_id: board.workflow_template_id,
    workflow_template_name: board.workflow_templates?.name ?? null,
  };

  if (!board.workflow_template_id) {
    const { data: tasks } = await supabase
      .from('board_cards')
      .select('id, title, description, due_date, assigned_to, column_id, position, assignee:profiles!board_cards_assigned_to_fkey(firstname, lastname), board_card_comments(count)')
      .eq('board_id', board.id)
      .order('position', { ascending: true });

    return {
      board: info,
      columns: columns ?? [],
      cards: [],
      tasks: (tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        assigned_to: task.assigned_to,
        assignee_name: [task.assignee?.firstname, task.assignee?.lastname].filter(Boolean).join(' ') || null,
        comments_count: task.board_card_comments?.[0]?.count ?? 0,
        column_id: task.column_id,
        position: task.position,
      })),
    };
  }

  const { data: processes } = columnIds.length
    ? await supabase
        .from('legal_processes')
        .select('id, process_number, status, document_number, created_at, board_column_id, board_position, legal_process_clients(first_name, last_name)')
        .in('board_column_id', columnIds)
        .order('board_position', { ascending: true })
    : { data: [] };

  const cards: BoardCard[] = (processes ?? []).map((p) => {
    const client = Array.isArray(p.legal_process_clients) ? p.legal_process_clients[0] : p.legal_process_clients;
    const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || null;
    return {
      id: p.id,
      process_number: p.process_number,
      status: p.status,
      client_name: clientName ?? '—',
      document_number: p.document_number,
      created_at: p.created_at,
      board_column_id: p.board_column_id as string,
      board_position: p.board_position,
    };
  });

  return { board: info, columns: columns ?? [], cards, tasks: [] };
}

export async function createBoardColumn(boardId: string, name: string): Promise<BoardColumn> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre de la columna no puede estar vacío');

  const { supabase, organizationId } = await requireOrgContext();

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', boardId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!board) throw new Error('Tablero no encontrado');

  const { data: existingColumns } = await supabase
    .from('legal_process_board_columns')
    .select('position, is_finished')
    .eq('board_id', boardId)
    .order('position', { ascending: true });

  // Las columnas nuevas van antes de "Finalizados", que cierra el tablero.
  const finished = (existingColumns ?? []).find((c) => c.is_finished);
  const lastOpen = (existingColumns ?? []).filter((c) => !c.is_finished).at(-1);
  const nextPosition = finished ? finished.position : (lastOpen?.position ?? -1) + 1;
  if (finished) {
    await supabase
      .from('legal_process_board_columns')
      .update({ position: finished.position + 1 })
      .eq('board_id', boardId)
      .eq('is_finished', true);
  }

  const { data, error } = await supabase
    .from('legal_process_board_columns')
    .insert({ organization_id: organizationId, board_id: boardId, name: trimmed, position: nextPosition, is_default: false })
    .select('id, name, position, is_finished')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la columna');

  revalidateBoard();
  return data;
}

export async function renameBoardColumn(columnId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre de la columna no puede estar vacío');

  const { supabase } = await requireOrgContext();

  const { error } = await supabase
    .from('legal_process_board_columns')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', columnId);

  if (error) throw new Error(error.message);
  revalidateBoard();
}

/**
 * Borra una columna (nunca "Finalizados" — bloqueado también por RLS). Sus
 * tarjetas pasan al final de la primera columna del tablero.
 */
export async function deleteBoardColumn(columnId: string): Promise<void> {
  const { supabase } = await requireOrgContext();

  const { data: column } = await supabase
    .from('legal_process_board_columns')
    .select('id, board_id, is_finished')
    .eq('id', columnId)
    .single();

  if (!column?.board_id) throw new Error('Columna no encontrada');
  if (column.is_finished) throw new Error('No se puede eliminar la columna de finalizados');

  const { data: siblings } = await supabase
    .from('legal_process_board_columns')
    .select('id, is_finished')
    .eq('board_id', column.board_id)
    .neq('id', columnId)
    .order('position', { ascending: true });

  const target = (siblings ?? []).find((c) => !c.is_finished) ?? siblings?.[0];
  if (!target) throw new Error('El tablero debe conservar al menos una columna');

  const [{ data: orphanedProcesses }, { data: orphanedTasks }, { data: lastProcess }, { data: lastTask }] = await Promise.all([
    supabase.from('legal_processes').select('id').eq('board_column_id', columnId).order('board_position'),
    supabase.from('board_cards').select('id').eq('column_id', columnId).order('position'),
    supabase.from('legal_processes').select('board_position').eq('board_column_id', target.id).order('board_position', { ascending: false }).limit(1),
    supabase.from('board_cards').select('position').eq('column_id', target.id).order('position', { ascending: false }).limit(1),
  ]);

  let nextProcess = (lastProcess?.[0]?.board_position ?? -1) + 1;
  let nextTask = (lastTask?.[0]?.position ?? -1) + 1;
  await Promise.all([
    ...(orphanedProcesses ?? []).map((p) =>
      supabase.from('legal_processes').update({ board_column_id: target.id, board_position: nextProcess++ }).eq('id', p.id),
    ),
    ...(orphanedTasks ?? []).map((task) =>
      supabase.from('board_cards').update({ column_id: target.id, position: nextTask++ }).eq('id', task.id),
    ),
  ]);

  const { error } = await supabase.from('legal_process_board_columns').delete().eq('id', columnId);
  if (error) throw new Error(error.message);

  revalidateBoard();
}

export async function reorderBoardColumns(orderedColumnIds: string[]): Promise<void> {
  const { supabase } = await requireOrgContext();

  await Promise.all(
    orderedColumnIds.map((id, index) =>
      supabase.from('legal_process_board_columns').update({ position: index }).eq('id', id),
    ),
  );

  revalidateBoard();
}

/**
 * Persiste el orden final de una columna después de un drag & drop — cubre
 * tanto reordenar dentro de la misma columna como mover una tarjeta desde
 * otra: `orderedLegalProcessIds` es la lista completa y final de esa
 * columna, incluyendo la tarjeta recién soltada ahí.
 */
export async function reorderBoardColumnCards(
  columnId: string,
  orderedLegalProcessIds: string[],
): Promise<void> {
  const { supabase, organizationId, userId } = await requireOrgContext();

  // Se llama tanto para reordenar dentro de la misma columna como para un
  // cambio real de columna (drag & drop) — solo lo segundo es "actividad"
  // digna del Historial del proceso, así que se detecta comparando contra
  // el board_column_id actual antes de sobreescribirlo.
  const { data: current } = await supabase
    .from('legal_processes')
    .select('id, board_column_id')
    .in('id', orderedLegalProcessIds);

  const moved = (current ?? []).filter((p) => p.board_column_id !== columnId);

  await Promise.all(
    orderedLegalProcessIds.map((id, index) =>
      supabase
        .from('legal_processes')
        .update({ board_column_id: columnId, board_position: index })
        .eq('id', id),
    ),
  );

  if (moved.length > 0) {
    const columnIds = [...new Set([columnId, ...moved.map((p) => p.board_column_id).filter((id): id is string => Boolean(id))])];
    const { data: columns } = await supabase
      .from('legal_process_board_columns')
      .select('id, name')
      .in('id', columnIds);
    const nameById = new Map((columns ?? []).map((c) => [c.id, c.name]));

    await supabase.from('audit_logs').insert(
      moved.map((p) => ({
        organization_id: organizationId,
        user_id: userId,
        action: 'board_card_moved',
        entity: 'legal_process',
        entity_id: p.id,
        metadata: {
          from_column: p.board_column_id ? (nameById.get(p.board_column_id) ?? null) : null,
          to_column: nameById.get(columnId) ?? null,
        },
      })),
    );
  }

  revalidateBoard();
}

function stringifyDescriptionValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)))
      .join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Lado izquierdo del modal de tarjeta (título + descripción, estilo
 * Trello) — no trae documentos ni adjuntos (eso vive en el detalle
 * completo del proceso, ver process-detail-sheet.tsx), pero sí todo el
 * relato del caso, de donde sea que se haya capturado.
 */
export async function getBoardCardDetail(legalProcessId: string): Promise<BoardCardDetail> {
  const { supabase, organizationId } = await requireOrgContext();

  const { data, error } = await supabase
    .from('legal_processes')
    .select('id, process_number, status, document_number, created_at, legal_process_clients(first_name, last_name, email, phone, address)')
    .eq('id', legalProcessId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Proceso no encontrado');

  const client = Array.isArray(data.legal_process_clients) ? data.legal_process_clients[0] : data.legal_process_clients;

  const description: BoardCardDescriptionSection[] = [];

  // ── Flujo legado: legal_process_banks ────────────────────────────────────
  const { data: bank } = await supabase
    .from('legal_process_banks')
    .select('bank_name, last_4_digits, fraud_incident_summary, products')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle();

  if (bank && (bank.bank_name || bank.fraud_incident_summary || bank.last_4_digits)) {
    const bankFields: BoardCardDescriptionField[] = [];
    if (bank.bank_name) bankFields.push({ label: 'Banco', value: bank.bank_name });
    // legal_process_banks.last_4_digits es, pese al nombre, el mismo resumen
    // legible que summarizeLast4Digits(products) ya produce (así lo escribe
    // financialFraudSync.ts) — mostrar ambos duplicaba la misma frase dos
    // veces. products es la fuente estructurada; last_4_digits queda solo
    // como fallback para filas viejas que no tengan products poblado.
    const productsSummary = Array.isArray(bank.products) && bank.products.length > 0
      ? summarizeLast4Digits(bank.products as unknown as FinancialProductValue[])
      : null;
    const productsValue = productsSummary ?? bank.last_4_digits;
    if (productsValue) bankFields.push({ label: 'Productos afectados', value: productsValue });
    if (bank.fraud_incident_summary) {
      bankFields.push({ label: 'Descripción de los hechos', value: bank.fraud_incident_summary });
    }
    if (bankFields.length > 0) description.push({ title: 'Caso', fields: bankFields });
  }

  // ── Dynamic Form Builder: legal_process_form_responses ──────────────────
  const { data: responses } = await supabase
    .from('legal_process_form_responses')
    .select('section_key, data, form_schema_id')
    .eq('legal_process_id', legalProcessId);

  if (responses && responses.length > 0) {
    const schemaIds = [...new Set(responses.map((r) => r.form_schema_id).filter((id): id is string => Boolean(id)))];
    const schemasById = new Map<string, FormSchema>();
    if (schemaIds.length > 0) {
      const { data: schemaRows } = await supabase
        .from('legal_process_form_schemas')
        .select('id, schema')
        .in('id', schemaIds);
      for (const row of schemaRows ?? []) schemasById.set(row.id, row.schema as unknown as FormSchema);
    }

    for (const response of responses) {
      const schema = response.form_schema_id ? schemasById.get(response.form_schema_id) : undefined;
      const section = schema?.sections.find((s) => s.key === response.section_key);
      if (!section) continue;

      const resolvedFields = organizationId ? await resolveFieldOptions(section.fields, supabase, organizationId) : section.fields;
      const sectionFields: BoardCardDescriptionField[] = [];

      for (const field of resolvedFields) {
        // Las imágenes/archivos son documentos, no texto de descripción —
        // se ven en el detalle completo del proceso, no acá.
        if (field.type === 'file_upload' || field.type === 'image_upload') continue;
        const rawValue = (response.data as Record<string, unknown> | null)?.[field.key];
        if (rawValue == null || rawValue === '') continue;

        const catalogOptions = field.optionsSource ? field.options : undefined;
        const value = field.type === 'financial_product' && Array.isArray(rawValue)
          // Mismo formato legible que ya usa BANKING.LAST_4_DIGITS en el
          // flujo legado — no el JSON crudo del array.
          ? (summarizeLast4Digits(rawValue as FinancialProductValue[]) ?? '')
          : catalogOptions
            ? (Array.isArray(rawValue)
              ? rawValue.map((v) => catalogOptions.find((o) => o.value === v)?.label ?? stringifyDescriptionValue(v)).join(', ')
              : catalogOptions.find((o) => o.value === rawValue)?.label ?? stringifyDescriptionValue(rawValue))
            : stringifyDescriptionValue(rawValue);

        if (value) sectionFields.push({ label: field.label, value });
      }

      if (sectionFields.length > 0) {
        description.push({ title: section.title ?? section.key, fields: sectionFields });
      }
    }
  }

  // ── Documentos asociados — generados (finales) + recibidos y aprobados ───
  // Los signed URLs guardados en DB expiran (7 días o menos) y se rompen en
  // silencio — se regeneran frescos acá en cada apertura del modal, mismo
  // criterio que getLegalProcessDetail.
  const [{ data: generatedDocs }, { data: receivedAttachments }] = await Promise.all([
    supabase
      .from('generated_documents')
      .select('id, document_name, storage_path, file_url, is_preview')
      .eq('legal_process_id', legalProcessId)
      .eq('is_preview', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('legal_process_email_attachments')
      .select('id, filename, storage_path, file_url, status')
      .eq('legal_process_id', legalProcessId)
      .eq('status', 'approved')
      .order('received_at', { ascending: true }),
  ]);

  const documents: BoardCardDocument[] = (
    await Promise.all([
      ...(generatedDocs ?? []).map(async (d) => ({
        id: d.id,
        name: d.document_name ?? 'Documento',
        url: d.storage_path ? await signFormResponsePath(supabase, d.storage_path) : (d.file_url ?? ''),
        kind: 'generated' as const,
      })),
      ...(receivedAttachments ?? []).map(async (a) => ({
        id: a.id,
        name: a.filename,
        url: a.storage_path ? await signFormResponsePath(supabase, a.storage_path) : (a.file_url ?? ''),
        kind: 'received' as const,
      })),
    ])
  ).filter((d) => d.url);

  return {
    id: data.id,
    process_number: data.process_number,
    status: data.status,
    document_number: data.document_number,
    created_at: data.created_at,
    client_name: [client?.first_name, client?.last_name].filter(Boolean).join(' ') || '—',
    client_email: client?.email ?? null,
    client_phone: client?.phone ?? null,
    client_address: client?.address ?? null,
    description,
    documents,
  };
}
