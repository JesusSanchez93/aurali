import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth/get-session-profile'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.workflows') };
}
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { userAgent } from 'next/server'
import { Laptop2, Sparkles, Workflow } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import { WorkflowSelector } from './workflow-selector'
import { getAvailableWorkflows } from '@/app/[locale]/onboarding/workflow-selection/actions'
import { updateEmailNodeConfig } from './actions'

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
  const t = await getTranslations('settings.workflows')
  const { profile } = await getSessionProfile()
  if (!profile) return null

  // SUPERADMIN: redirect to the admin management section
  if (profile.system_role === 'SUPERADMIN') {
    redirect('/admin/workflows')
  }

  const requestHeaders = await headers()
  const { device } = userAgent({ headers: requestHeaders })
  const isMobilePhone = device.type === 'mobile'

  if (isMobilePhone) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_38%),linear-gradient(180deg,_#faf7f2_0%,_#ffffff_48%,_#f6f1e8_100%)] px-5 py-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground shadow-sm backdrop-blur">
              {t('mobile_blocked_eyebrow')}
            </span>

            <div className="rounded-[28px] border border-black/10 bg-white/90 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171717] text-white shadow-lg">
                    <Workflow className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="max-w-[12ch] text-[1.85rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#111111]">
                      {t('mobile_blocked_title')}
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t('mobile_blocked_description')}
                    </p>
                  </div>
                </div>

                <div className="relative hidden shrink-0 sm:block">
                  <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#f4c95d] text-[#111111] shadow">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex h-20 w-16 items-center justify-center rounded-[1.6rem] border border-black/10 bg-[#f6f1e8]">
                    <div className="h-12 w-10 rounded-[0.9rem] border border-black/10 bg-white shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-black/10 bg-[#fcfaf7] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#111111] shadow-sm">
                    <Laptop2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#111111]">
                      {t('mobile_blocked_hint_title')}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t('mobile_blocked_hint_description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ORG_ADMIN (and future roles): show read-only view of selected workflow
  const supabase = await createClient()
  const db = supabase as Supabase
  const orgId = profile.current_organization_id

  if (!orgId) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">{t('no_active_organization')}</p>
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

  // Load nodes and edges in parallel
  const [{ data: dbNodes }, { data: dbEdges }] = await Promise.all([
    db
      .from('workflow_nodes')
      .select('*')
      .eq('template_id', template.id)
      .order('created_at', { ascending: true }) as Promise<{ data: DbWorkflowNode[] | null }>,
    db
      .from('workflow_edges')
      .select('*')
      .eq('template_id', template.id) as Promise<{ data: DbWorkflowEdge[] | null }>,
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
    type: 'bezier' as const,
    animated: true,
    markerEnd: { type: 'arrowclosed' as const, width: 18, height: 18 },
    data: (e.condition ?? undefined) as undefined,
  }))

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('readonly_title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('readonly_description')}
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
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
