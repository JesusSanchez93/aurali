import { createClient } from '@/lib/supabase/server'
import type { OrgPlan } from './types'

const DEFAULT_PLAN_CODE_FOR_NEW_ORGS = 'essential'
// Toda cuenta nueva entra al plan básico con 30 días gratis: es lo que
// promete el landing (landing.pricing en messages/*.json).
const TRIAL_PERIOD_DAYS_BY_PLAN_CODE: Record<string, number> = {
  essential: 30,
  professional: 30,
}

/**
 * El trigger `handle_new_user` crea la organización en el signup pero no una
 * fila en `organization_subscriptions` — se crea aquí, en trial, la primera
 * vez que se consulta el plan de una organización sin suscripción.
 */
async function createDefaultSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
) {
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, code')
    .eq('code', DEFAULT_PLAN_CODE_FOR_NEW_ORGS)
    .single()

  if (planError || !plan) {
    throw new Error(`No se encontró el plan por defecto "${DEFAULT_PLAN_CODE_FOR_NEW_ORGS}".`)
  }

  const trialDays = TRIAL_PERIOD_DAYS_BY_PLAN_CODE[plan.code ?? ''] ?? 15
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

  const { error: insertError } = await supabase
    .from('organization_subscriptions')
    .insert({
      organization_id: organizationId,
      plan_id: plan.id,
      status: 'trial',
      billing_cycle: 'monthly',
      trial_ends_at: trialEndsAt.toISOString(),
    })

  if (insertError) {
    throw new Error(`No se pudo crear la suscripción por defecto: ${insertError.message}`)
  }
}

/**
 * Plan efectivo de una organización — estado, vencimiento y límites del plan
 * contratado. Usa el cliente admin porque se invoca desde contextos sin
 * sesión de usuario (motor de workflows, crons).
 */
export async function getOrgPlan(organizationId: string): Promise<OrgPlan> {
  const supabase = await createClient({ admin: true })

  let { data } = await supabase
    .from('organization_subscriptions')
    .select(
      'id, status, billing_cycle, agreed_price_cents, trial_ends_at, current_period_end, plans(id, code, name, price_monthly_cents, list_price_monthly_cents, max_users, max_monthly_processes, max_storage_gb, max_workflows, max_monthly_ai_uses, features)',
    )
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!data) {
    await createDefaultSubscription(supabase, organizationId)
    ;({ data } = await supabase
      .from('organization_subscriptions')
      .select(
        'id, status, billing_cycle, agreed_price_cents, trial_ends_at, current_period_end, plans(id, code, name, price_monthly_cents, list_price_monthly_cents, max_users, max_monthly_processes, max_storage_gb, max_workflows, max_monthly_ai_uses, features)',
      )
      .eq('organization_id', organizationId)
      .maybeSingle())
  }

  if (!data || !data.plans) {
    throw new Error(`No se pudo resolver el plan de la organización ${organizationId}.`)
  }

  const plan = data.plans

  return {
    subscriptionId: data.id,
    status: data.status as OrgPlan['status'],
    billingCycle: data.billing_cycle as OrgPlan['billingCycle'],
    agreedPriceCents: data.agreed_price_cents,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    plan: {
      id: plan.id,
      code: plan.code ?? '',
      name: plan.name ?? '',
      priceMonthlyCents: plan.price_monthly_cents,
      listPriceMonthlyCents: plan.list_price_monthly_cents,
      maxUsers: plan.max_users,
      maxMonthlyProcesses: plan.max_monthly_processes,
      maxStorageGb: plan.max_storage_gb,
      maxWorkflows: plan.max_workflows,
      maxMonthlyAiUses: plan.max_monthly_ai_uses,
      features: (plan.features ?? {}) as OrgPlan['plan']['features'],
    },
  }
}

const GRACE_PERIOD_DAYS = 7

/**
 * false si la suscripción está vencida (past_due/canceled, o trial vencido)
 * y ya pasaron los días de gracia desde el vencimiento — bloquea creación y
 * edición, nunca lectura/descarga de lo ya generado.
 */
export async function isSubscriptionWritable(organizationId: string): Promise<boolean> {
  const orgPlan = await getOrgPlan(organizationId)

  const graceDeadline = (dateStr: string | null) => {
    if (!dateStr) return null
    const deadline = new Date(dateStr)
    deadline.setDate(deadline.getDate() + GRACE_PERIOD_DAYS)
    return deadline
  }

  const now = new Date()

  if (orgPlan.status === 'past_due' || orgPlan.status === 'canceled') {
    const deadline = graceDeadline(orgPlan.currentPeriodEnd)
    return deadline ? now < deadline : false
  }

  if (orgPlan.status === 'trial') {
    const deadline = graceDeadline(orgPlan.trialEndsAt)
    if (!deadline) return true
    return now < deadline
  }

  return true
}
