'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveFieldOptions } from '@/lib/forms/catalogOptions';
import { signFormResponsePath } from '@/lib/forms/resolveFormResponseFileUrls';
import { summarizeLast4Digits } from '@/lib/forms/financialProduct';
import type { FormSchema, FinancialProductValue } from '@/lib/forms/types';

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
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
  columns: BoardColumn[];
  cards: BoardCard[];
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

async function requireOrgContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user || authError) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Organization not found');

  return { supabase, organizationId: profile.current_organization_id, userId: user.id };
}

/**
 * La columna "Finalizados" es la que el trigger assign_default_board_column
 * (ver migración legal_process_board) engancha automáticamente al llegar un
 * proceso a status='finished' — pero solo se crea la primera vez que eso
 * pasa. Si el abogado visita el tablero antes de tener algún proceso
 * finalizado, esto la crea igual, para que ya pueda armar sus columnas.
 */
async function ensureDefaultColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('legal_process_board_columns')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_default', true)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('legal_process_board_columns')
    .insert({ organization_id: organizationId, name: 'Finalizados', position: 0, is_default: true })
    .select('id')
    .single();

  if (error || !created) throw new Error(error?.message ?? 'No se pudo crear la columna por defecto');
  return created.id;
}

function revalidateBoard() {
  revalidatePath('/board');
}

export async function getBoardData(): Promise<BoardData> {
  const { supabase, organizationId } = await requireOrgContext();

  await ensureDefaultColumn(supabase, organizationId);

  const [{ data: columns }, { data: processes }] = await Promise.all([
    supabase
      .from('legal_process_board_columns')
      .select('id, name, position, is_default')
      .eq('organization_id', organizationId)
      .order('position', { ascending: true }),
    supabase
      .from('legal_processes')
      .select('id, process_number, status, document_number, created_at, board_column_id, board_position, legal_process_clients(first_name, last_name)')
      .eq('organization_id', organizationId)
      .not('board_column_id', 'is', null)
      .order('board_position', { ascending: true }),
  ]);

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

  return { columns: columns ?? [], cards };
}

export async function createBoardColumn(name: string): Promise<BoardColumn> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre de la columna no puede estar vacío');

  const { supabase, organizationId } = await requireOrgContext();

  const { data: existingColumns } = await supabase
    .from('legal_process_board_columns')
    .select('position')
    .eq('organization_id', organizationId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = (existingColumns?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('legal_process_board_columns')
    .insert({ organization_id: organizationId, name: trimmed, position: nextPosition, is_default: false })
    .select('id, name, position, is_default')
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
 * Borra una columna (nunca la default — bloqueado también por RLS). Las
 * tarjetas que tenía se reubican al final de la columna default, para no
 * perder de vista ningún proceso.
 */
export async function deleteBoardColumn(columnId: string): Promise<void> {
  const { supabase, organizationId } = await requireOrgContext();

  const { data: column } = await supabase
    .from('legal_process_board_columns')
    .select('id, is_default')
    .eq('id', columnId)
    .single();

  if (!column) throw new Error('Columna no encontrada');
  if (column.is_default) throw new Error('No se puede eliminar la columna por defecto');

  const defaultColumnId = await ensureDefaultColumn(supabase, organizationId);

  const [{ data: orphaned }, { data: defaultCards }] = await Promise.all([
    supabase
      .from('legal_processes')
      .select('id')
      .eq('board_column_id', columnId)
      .order('board_position', { ascending: true }),
    supabase
      .from('legal_processes')
      .select('board_position')
      .eq('board_column_id', defaultColumnId)
      .order('board_position', { ascending: false })
      .limit(1),
  ]);

  let nextPosition = (defaultCards?.[0]?.board_position ?? -1) + 1;
  if (orphaned && orphaned.length > 0) {
    await Promise.all(
      orphaned.map((p) =>
        supabase
          .from('legal_processes')
          .update({ board_column_id: defaultColumnId, board_position: nextPosition++ })
          .eq('id', p.id),
      ),
    );
  }

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
