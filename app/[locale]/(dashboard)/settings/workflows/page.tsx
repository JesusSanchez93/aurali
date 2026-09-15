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

  const requestHeaders = await headers()
  const { device } = userAgent({ headers: requestHeaders })
  const isMobilePhone = device.type === 'mobile'

  if (isMobilePhone) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_38%),linear-gradient(180deg,_#faf7f2_0%,_#ffffff_48%,_#f6f1e8_100%)] px-5 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_38%),linear-gradient(180deg,_#0a0a0f_0%,_#0d0d12_48%,_#151218_100%)]">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              {t('mobile_blocked_eyebrow')}
            </span>

            <div className="rounded-[28px] border border-black/10 bg-white/90 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#171717] text-white shadow-lg dark:bg-white dark:text-[#171717]">
                    <Workflow className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="max-w-[12ch] text-[1.85rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#111111] dark:text-white">
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
                  <div className="flex h-20 w-16 items-center justify-center rounded-[1.6rem] border border-black/10 bg-[#f6f1e8] dark:border-white/10 dark:bg-white/10">
                    <div className="h-12 w-10 rounded-[0.9rem] border border-black/10 bg-white shadow-inner dark:border-white/10 dark:bg-white/20" />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-black/10 bg-[#fcfaf7] p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#111111] shadow-sm dark:bg-white/10 dark:text-white">
                    <Laptop2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#111111] dark:text-white">
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

  // Find ALL active workflow assignments for this org — an organization can
  // run several tipos de proceso legal (workflow_templates) in parallel.
  const { data: assignments } = await db
    .from('organization_workflows')
    .select('workflow_template_id, workflow_templates(id, name, description, is_legacy_form)')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  const activeTemplates = (assignments ?? [])
    .map((a: { workflow_templates: { id: string; name: string; description: string | null; is_legacy_form: boolean } | null }) => a.workflow_templates)
    .filter((wf: unknown): wf is { id: string; name: string; description: string | null; is_legacy_form: boolean } => Boolean(wf))

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
