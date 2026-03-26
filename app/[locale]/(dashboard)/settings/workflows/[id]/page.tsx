import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth/get-session-profile'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import { loadWorkflow } from './actions'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function WorkflowEditorPage({ params }: Props) {
  const { profile } = await getSessionProfile()

  // Only SUPERADMIN can access the full editor.
  // ORG_ADMIN should use /settings/workflows (read-only).
  if (!profile || profile.system_role !== 'SUPERADMIN') {
    redirect('/settings/workflows')
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: template } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from('workflow_templates')
    .select('id, name, description')
    .eq('id', id)
    .single()

  if (!template) notFound()

  const { nodes, edges } = await loadWorkflow(id)

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <WorkflowEditor
        templateId={template.id}
        templateName={template.name ?? 'Flujo sin nombre'}
        initialNodes={nodes}
        initialEdges={edges}
      />
    </div>
  )
}
