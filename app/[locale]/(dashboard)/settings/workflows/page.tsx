import { createClient } from '@/lib/supabase/server'
import { getSessionProfile } from '@/lib/auth/get-session-profile'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.workflows') };
}
import { redirect } from 'next/navigation'
import { WorkflowSelector } from './workflow-selector'
import { ActiveWorkflowsManager } from './_components/active-workflows-manager'
import { getAvailableWorkflows } from '@/app/[locale]/onboarding/workflow-selection/actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export default async function WorkflowsPage() {
  const t = await getTranslations('settings.workflows')
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
        <p className="text-sm text-muted-foreground">{t('no_active_organization')}</p>
      </div>
    )
  }

  // Find ALL active workflow assignments for this org — an organization can
  // run several tipos de proceso legal (workflow_templates) in parallel.
  const { data: assignments } = await db
    .from('organization_workflows')
    .select('workflow_template_id, workflow_templates(id, name, description, is_legacy_form, icon_svg, gradient_color, gradient_color_to)')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  const activeTemplates = (assignments ?? [])
    .map((a: { workflow_templates: { id: string; name: string; description: string | null; is_legacy_form: boolean; icon_svg: string | null; gradient_color: string | null; gradient_color_to: string | null } | null }) => a.workflow_templates)
    .filter((wf: unknown): wf is { id: string; name: string; description: string | null; is_legacy_form: boolean; icon_svg: string | null; gradient_color: string | null; gradient_color_to: string | null } => Boolean(wf))

  if (activeTemplates.length === 0) {
    const workflows = await getAvailableWorkflows()
    return <WorkflowSelector workflows={workflows} />
  }

  const allWorkflows = await getAvailableWorkflows()
  const availableToActivate = allWorkflows.filter(
    (wf) => !activeTemplates.some((active: { id: string }) => active.id === wf.id),
  )

  return (
    <ActiveWorkflowsManager
      activeTemplates={activeTemplates}
      availableToActivate={availableToActivate}
      title={t('readonly_title')}
      description={t('readonly_description')}
    />
  )
}
