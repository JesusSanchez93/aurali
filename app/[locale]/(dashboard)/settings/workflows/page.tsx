import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth/get-session-profile'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import { WorkflowSelector } from './workflow-selector'
import { getAvailableWorkflows } from '@/app/[locale]/onboarding/workflow-selection/actions'
import { updateEmailNodeConfig, getDocumentTemplates } from './actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

interface DbWorkflowNode {
  id: string; node_id: string; type: string; title: string
  config: Record<string, unknown>; position_x: number; position_y: number; created_at: string
}
interface DbWorkflowEdge {
  id: string; source_node_id: string; target_node_id: string
  source_handle_id: string | null; target_handle_id: string | null
  condition: Record<string, unknown> | null
}

export default async function WorkflowsPage() {
  const { profile } = await getSessionProfile()
  if (!profile) return null

  // SUPERADMIN: redirect to the admin management section
  if (profile.system_role === 'SUPERADMIN') {
    redirect('/admin/workflows')
  }

  // ORG_ADMIN (and future roles): show read-only view of selected workflow
  const supabase = await createClient()
  const db = supabase as Supabase
  const orgId = profile.current_organization_id

  if (!orgId) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">No tienes una organización activa.</p>
      </div>
    )
  }

  // Find the active workflow assignment for this org
  const { data: assignment } = await db
    .from('organization_workflows')
    .select('workflow_template_id, workflow_templates(id, name, description)')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .single()

  const template = assignment?.workflow_templates as
    | { id: string; name: string; description: string | null }
    | null
    | undefined

  if (!template) {
    const workflows = await getAvailableWorkflows()
    return <WorkflowSelector workflows={workflows} />
  }

  // Load nodes, edges and org document templates in parallel
  const [{ data: dbNodes }, { data: dbEdges }, documentTemplates] = await Promise.all([
    db
      .from('workflow_nodes')
      .select('*')
      .eq('template_id', template.id)
      .order('created_at', { ascending: true }) as Promise<{ data: DbWorkflowNode[] | null }>,
    db
      .from('workflow_edges')
      .select('*')
      .eq('template_id', template.id) as Promise<{ data: DbWorkflowEdge[] | null }>,
    getDocumentTemplates(),
  ])

  const nodes = (dbNodes ?? []).map((n) => ({
    id: n.node_id,
    type: n.type as 'start',
    position: { x: n.position_x, y: n.position_y },
    data: { nodeId: n.node_id, type: n.type as 'start', title: n.title, config: n.config ?? {} },
  }))

  const edges = (dbEdges ?? []).map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    sourceHandle: e.source_handle_id ?? undefined,
    targetHandle: e.target_handle_id ?? undefined,
    type: 'smoothstep' as const,
    animated: true,
    data: (e.condition ?? undefined) as undefined,
  }))

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Flujo de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Vista del flujo activo de tu organización. Solo lectura.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{template.name}</CardTitle>
          {template.description && (
            <CardDescription>{template.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[calc(100vh-18rem)] overflow-hidden rounded-b-lg">
            <WorkflowEditor
              templateId={template.id}
              templateName={template.name ?? ''}
              initialNodes={nodes}
              initialEdges={edges}
              readOnly
              backHref="/settings/workflows"
              onNodeEdit={updateEmailNodeConfig}
              documentTemplates={documentTemplates}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
