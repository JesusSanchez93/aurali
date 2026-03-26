import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import { loadAdminWorkflow, saveAdminWorkflow } from './actions'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function AdminWorkflowBuilderPage({ params }: Props) {
  await requireSuperAdmin()

  const { id } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: template } = await (supabase as any)
    .from('workflow_templates')
    .select('id, name, description')
    .eq('id', id)
    .is('organization_id', null) // only global templates
    .single()

  if (!template) notFound()

  const { nodes, edges } = await loadAdminWorkflow(id)

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <WorkflowEditor
        templateId={template.id}
        templateName={template.name ?? 'Flujo sin nombre'}
        initialNodes={nodes}
        initialEdges={edges}
        onSave={saveAdminWorkflow}
        backHref="/admin/workflows"
      />
    </div>
  )
}
