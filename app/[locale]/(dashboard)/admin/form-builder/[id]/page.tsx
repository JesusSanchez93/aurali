import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { fetchAllCatalogOptions } from '@/lib/forms/catalogOptions'
import { getAvailableWorkflowTemplates, getOrCreateDraftByCode } from './actions'
import { FormBuilderCanvas } from './_components/FormBuilderCanvas'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function AdminFormBuilderPage({ params }: Props) {
  await requireSuperAdmin()

  // `id` es el `code` del formulario (identidad estable a través de sus
  // versiones draft/publish) — no el workflow_template_id, ya que un mismo
  // flujo puede tener varios formularios.
  const { id: code } = await params
  const supabase = await createClient()

  const [pageData, catalogOptions, workflowTemplateOptions] = await Promise.all([
    getOrCreateDraftByCode(code),
    fetchAllCatalogOptions(supabase),
    getAvailableWorkflowTemplates(),
  ])

  if (!pageData) notFound()

  return (
    <FormBuilderCanvas
      initialSchemaRow={pageData.draft}
      catalogOptions={catalogOptions}
      workflowTemplateOptions={workflowTemplateOptions}
    />
  )
}
