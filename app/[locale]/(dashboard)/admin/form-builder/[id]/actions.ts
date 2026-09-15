'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { FormSchema } from '@/lib/forms/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

const EMPTY_SCHEMA: FormSchema = { version: 1, sections: [] }

export interface FormSchemaRow {
  id: string
  workflow_template_id: string
  code: string
  name: string
  schema: FormSchema
  version: number
  is_published: boolean
  updated_at: string
}

export interface FormBuilderPageData {
  draft: FormSchemaRow
  workflowTemplateName: string
}

/**
 * Un mismo workflow_template (tipo de flujo) puede tener varios formularios
 * asociados — cada uno es identificado por su propio `code` (estable a
 * través de sus versiones draft/publish), no por el template. La ruta
 * /admin/form-builder/[id] usa ese `code` como identificador.
 *
 * Devuelve el draft (is_published = false) de ese `code`, creándolo si no
 * existe (se reabre un formulario publicado para editar "sobre" él). Si el
 * código no corresponde a ningún formulario, devuelve null (404 en la page).
 * SUPERADMIN only.
 */
export async function getOrCreateDraftByCode(code: string): Promise<FormBuilderPageData | null> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: existingDraft, error: draftErr } = await db
    .from('legal_process_form_schemas')
    .select('id, workflow_template_id, code, name, schema, version, is_published, updated_at')
    .eq('code', code)
    .eq('is_published', false)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (draftErr) throw new Error(draftErr.message)

  let draft = existingDraft as FormSchemaRow | null

  if (!draft) {
    const { data: published, error: publishedErr } = await db
      .from('legal_process_form_schemas')
      .select('workflow_template_id, name, schema, version')
      .eq('code', code)
      .eq('is_published', true)
      .maybeSingle()

    if (publishedErr) throw new Error(publishedErr.message)
    if (!published) return null

    const { data: created, error: createErr } = await db
      .from('legal_process_form_schemas')
      .insert({
        workflow_template_id: published.workflow_template_id,
        code,
        name: published.name,
        schema: published.schema,
        version: published.version + 1,
        is_published: false,
      })
      .select('id, workflow_template_id, code, name, schema, version, is_published, updated_at')
      .single()

    if (createErr) throw new Error(createErr.message)
    draft = created as FormSchemaRow
  }

  const { data: template } = await db
    .from('workflow_templates')
    .select('name')
    .eq('id', draft.workflow_template_id)
    .single()

  return { draft, workflowTemplateName: template?.name ?? 'Flujo sin nombre' }
}

/**
 * Crea un formulario NUEVO e independiente (code propio) para un
 * workflow_template — a diferencia de getOrCreateDraftByCode, siempre inserta
 * una fila nueva, permitiendo varios formularios sobre el mismo flujo.
 * El nombre por defecto es `formulario_{code}` (el `code` solo se conoce
 * después del insert, ya que la columna lo autogenera) — editable de
 * inmediato desde el propio builder.
 * SUPERADMIN only.
 */
export async function createNewForm(workflowTemplateId: string): Promise<{ code: string }> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: created, error } = await db
    .from('legal_process_form_schemas')
    .insert({
      workflow_template_id: workflowTemplateId,
      name: '',
      schema: EMPTY_SCHEMA,
      version: 1,
      is_published: false,
    })
    .select('code')
    .single()

  if (error) throw new Error(error.message)

  const defaultName = `formulario_${created.code}`
  const { error: nameErr } = await db
    .from('legal_process_form_schemas')
    .update({ name: defaultName })
    .eq('code', created.code)

  if (nameErr) throw new Error(nameErr.message)

  revalidatePath('/admin/form-builder')
  return { code: created.code }
}

/**
 * Duplica un formulario existente: copia su secciones/campos (tomando la
 * versión publicada si existe, o el draft si no) a un formulario NUEVO e
 * independiente (code propio, siempre borrador), sobre el mismo flujo.
 * Útil para iterar una v2 sin afectar la versión en uso.
 * SUPERADMIN only.
 */
export async function duplicateForm(code: string): Promise<{ code: string }> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: versions, error: versionsErr } = await db
    .from('legal_process_form_schemas')
    .select('workflow_template_id, name, schema, is_published')
    .eq('code', code)
    .order('is_published', { ascending: false })

  if (versionsErr) throw new Error(versionsErr.message)
  const source = versions?.[0]
  if (!source) throw new Error('Formulario no encontrado')

  const { data: created, error: createErr } = await db
    .from('legal_process_form_schemas')
    .insert({
      workflow_template_id: source.workflow_template_id,
      name: `${source.name} (copia)`,
      schema: source.schema,
      version: 1,
      is_published: false,
    })
    .select('code')
    .single()

  if (createErr) throw new Error(createErr.message)

  revalidatePath('/admin/form-builder')
  return { code: created.code }
}

/**
 * Elimina un formulario por completo (todas sus versiones — draft y
 * publicada — comparten `code`). Bloqueado si algún legal_process ya lo
 * referencia (FK sin ON DELETE CASCADE, a propósito: nunca se debe borrar un
 * formulario en uso por un caso real).
 * SUPERADMIN only.
 */
export async function deleteForm(code: string): Promise<void> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { error } = await db.from('legal_process_form_schemas').delete().eq('code', code)

  if (error) {
    if (error.code === '23503') {
      throw new Error('Este formulario está en uso por procesos legales existentes y no se puede eliminar.')
    }
    throw new Error(error.message)
  }

  revalidatePath('/admin/form-builder')
}

export interface WorkflowTemplateOption {
  id: string
  name: string
}

/**
 * Lista los tipos de flujo (workflow_templates globales, no legados)
 * disponibles para asociar un formulario — usado por el select "Tipo de
 * flujo" dentro del builder. Un mismo flujo puede tener varios formularios,
 * así que se listan todos los no-legados, sin filtrar por si ya tienen uno.
 * SUPERADMIN only.
 */
export async function getAvailableWorkflowTemplates(): Promise<WorkflowTemplateOption[]> {
  await requireSuperAdmin()

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workflow_templates')
    .select('id, name')
    .is('organization_id', null)
    .eq('is_legacy_form', false)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Reasigna el formulario a otro tipo de flujo (workflow_template). Como un
 * flujo puede tener varios formularios, no hay conflicto posible — solo
 * actualiza la referencia.
 * SUPERADMIN only.
 */
export async function updateFormWorkflowTemplate(schemaId: string, newWorkflowTemplateId: string): Promise<void> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { error } = await db
    .from('legal_process_form_schemas')
    .update({ workflow_template_id: newWorkflowTemplateId })
    .eq('id', schemaId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/form-builder')
}

/**
 * Guarda el nombre y contenido del draft (autosave o botón "Guardar borrador").
 * SUPERADMIN only.
 */
export async function saveDraftSchema(schemaId: string, name: string, schema: FormSchema): Promise<void> {
  const profile = await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { error } = await db
    .from('legal_process_form_schemas')
    .update({ name, schema, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq('id', schemaId)
    .eq('is_published', false)

  if (error) throw new Error(error.message)
}

/**
 * Publica un draft: despublica cualquier otra versión publicada del MISMO
 * formulario (mismo `code` — no del resto del flujo, que puede tener otros
 * formularios propios) y marca este como publicado.
 * SUPERADMIN only.
 */
export async function publishSchemaAction(schemaId: string): Promise<void> {
  await requireSuperAdmin()

  const supabase = await createClient()
  const db = supabase as Supabase

  const { data: row, error: rowErr } = await db
    .from('legal_process_form_schemas')
    .select('code')
    .eq('id', schemaId)
    .single()

  if (rowErr || !row) throw new Error(rowErr?.message ?? 'Formulario no encontrado')

  const { error: unpublishErr } = await db
    .from('legal_process_form_schemas')
    .update({ is_published: false })
    .eq('code', row.code)
    .eq('is_published', true)

  if (unpublishErr) throw new Error(unpublishErr.message)

  const { error: publishErr } = await db
    .from('legal_process_form_schemas')
    .update({ is_published: true })
    .eq('id', schemaId)

  if (publishErr) throw new Error(publishErr.message)

  revalidatePath(`/admin/form-builder/${row.code}`)
  revalidatePath('/admin/form-builder')
}
