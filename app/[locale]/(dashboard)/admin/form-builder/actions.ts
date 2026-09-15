'use server'

import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { buildFormExportPayload, formExportPayloadSchema, type FormExportPayload } from '@/lib/forms/formExport'
import type { FormSchema } from '@/lib/forms/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

/**
 * Si `desiredName` ya existe entre los formularios de la cuenta, devuelve una
 * variante con sufijo " (1)", " (2)", etc. — el primer número libre. Si no
 * hay colisión, devuelve el nombre tal cual.
 */
async function resolveUniqueFormName(supabase: Supabase, desiredName: string): Promise<string> {
  const { data, error } = await supabase.from('legal_process_form_schemas').select('name')
  if (error) throw new Error(error.message)

  const existingNames = new Set((data ?? []).map((row: { name: string }) => row.name))
  if (!existingNames.has(desiredName)) return desiredName

  let suffix = 1
  while (existingNames.has(`${desiredName} (${suffix})`)) {
    suffix += 1
  }
  return `${desiredName} (${suffix})`
}

export interface FormBuilderFormRow {
  /** id de legal_process_form_schemas (draft o publicado representativo) */
  schema_id: string
  /** code — identidad del formulario a través de sus versiones draft/publish */
  code: string
  form_name: string
  is_published: boolean
}

export interface FormBuilderGroup {
  workflow_template_id: string
  workflow_template_name: string
  is_legacy_form: boolean
  /** Uno o más formularios de este flujo — un mismo flujo puede tener varios
   *  formularios (agrupados por `code`), ej. para más de una recolección de
   *  datos dentro del mismo proceso. */
  forms: FormBuilderFormRow[]
}

/**
 * Lista los tipos de flujo agrupando sus formularios dinámicos — cada grupo
 * es un flujo (workflow_template), y dentro se listan sus formularios por
 * nombre propio (agrupados por `code`, así un flujo con más de un formulario
 * a futuro los mostraría todos). SUPERADMIN only.
 */
export async function getFormBuilderGroups(): Promise<FormBuilderGroup[]> {
  await requireSuperAdmin()

  const supabase = await createClient()

  const { data: templates, error } = await supabase
    .from('workflow_templates')
    .select('id, name, is_legacy_form')
    .is('organization_id', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!templates || templates.length === 0) return []

  const { data: schemas } = await supabase
    .from('legal_process_form_schemas')
    .select('id, workflow_template_id, code, name, is_published, updated_at')
    .in('workflow_template_id', templates.map((t) => t.id))
    .order('updated_at', { ascending: false })

  return templates.map((t) => {
    const templateSchemas = (schemas ?? []).filter((s) => s.workflow_template_id === t.id)

    // Un mismo formulario puede tener 2 filas (draft + publicado) que
    // comparten `code` — se agrupan para representarlo como UNA entrada,
    // prefiriendo la versión publicada.
    const byCode = new Map<string, typeof templateSchemas>()
    for (const s of templateSchemas) {
      const list = byCode.get(s.code) ?? []
      list.push(s)
      byCode.set(s.code, list)
    }

    const forms: FormBuilderFormRow[] = Array.from(byCode.values()).map((versions) => {
      const published = versions.find((v) => v.is_published)
      // versions ya viene ordenado por updated_at desc (heredado de la query)
      const representative = published ?? versions[0]
      return {
        schema_id: representative.id,
        code: representative.code,
        form_name: representative.name || t.name,
        is_published: Boolean(published),
      }
    })

    return {
      workflow_template_id: t.id,
      workflow_template_name: t.name,
      is_legacy_form: t.is_legacy_form,
      forms,
    }
  })
}

/**
 * Exporta un formulario (por `code`) como payload portable — pensado para
 * moverlo a otro ambiente (dev → prod) u organización vía el botón
 * "Exportar" de la lista. Toma la versión publicada; si no hay ninguna,
 * exporta el draft más reciente. No incluye id/code/workflow_template_id
 * (no son portables) — ver lib/forms/formExport.ts.
 * SUPERADMIN only.
 */
export async function exportForm(code: string): Promise<FormExportPayload> {
  await requireSuperAdmin()

  const supabase = await createClient()

  const { data: versions, error } = await supabase
    .from('legal_process_form_schemas')
    .select('name, schema, domain_sync_key, is_published, workflow_template_id')
    .eq('code', code)
    .order('is_published', { ascending: false })

  if (error) throw new Error(error.message)
  const source = versions?.[0]
  if (!source) throw new Error('Formulario no encontrado')

  const { data: template } = await supabase
    .from('workflow_templates')
    .select('name')
    .eq('id', source.workflow_template_id)
    .maybeSingle()

  return buildFormExportPayload({
    name: source.name,
    schema: source.schema as unknown as FormSchema,
    domain_sync_key: source.domain_sync_key,
    workflowTemplateName: template?.name,
  })
}

/**
 * Importa un formulario exportado como un formulario NUEVO e independiente
 * (code propio, generado por la BD), asociado al workflow_template elegido
 * por el super_admin en este ambiente/cuenta — mismo patrón que
 * createNewForm/duplicateForm (admin/form-builder/[id]/actions.ts).
 * SUPERADMIN only.
 */
export async function importForm(
  workflowTemplateId: string,
  payload: FormExportPayload,
): Promise<{ code: string }> {
  await requireSuperAdmin()

  const parsed = formExportPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error('El archivo no tiene el formato esperado de un formulario exportado.')
  }

  const supabase = await createClient()

  const name = await resolveUniqueFormName(supabase, parsed.data.name)

  const { data: created, error } = await supabase
    .from('legal_process_form_schemas')
    .insert({
      workflow_template_id: workflowTemplateId,
      name,
      schema: parsed.data.schema as never,
      domain_sync_key: parsed.data.domainSyncKey,
      version: 1,
      is_published: false,
    })
    .select('code')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/admin/form-builder')
  return { code: created.code }
}
