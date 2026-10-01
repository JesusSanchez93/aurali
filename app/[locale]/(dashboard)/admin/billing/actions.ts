'use server'

import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

type SubscriptionStatus = Database['public']['Tables']['organization_subscriptions']['Row']['status']
type BillingCycle = Database['public']['Tables']['organization_subscriptions']['Row']['billing_cycle']

export interface PlanOption {
  id: string
  code: string
  name: string
}

export interface OrgBillingRow {
  organizationId: string
  organizationName: string | null
  subscriptionId: string
  planId: string
  planCode: string
  planName: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  agreedPriceCents: number | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  usage: {
    processes: number
    aiUses: number
    users: number
    storageGb: number
  }
  limits: {
    maxMonthlyProcesses: number | null
    maxMonthlyAiUses: number | null
    maxUsers: number | null
    maxStorageGb: number | null
  }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export async function getAvailablePlans(): Promise<PlanOption[]> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { data, error } = await supabase
    .from('plans')
    .select('id, code, name')
    .not('code', 'is', null)
    .order('price_monthly_cents', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({ id: p.id, code: p.code ?? '', name: p.name ?? '' }))
}

/** Tabla de organizaciones con plan, estado, vencimiento y uso del mes en
 *  curso — bulk fetch (no usa lib/billing/* por organización, pensado para
 *  listar todas las orgs de una sola vez). SUPERADMIN only. */
export async function getOrganizationsBillingOverview(): Promise<OrgBillingRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })
  const period = currentPeriod()

  const { data: subs, error } = await supabase
    .from('organization_subscriptions')
    .select(
      'id, organization_id, plan_id, status, billing_cycle, agreed_price_cents, trial_ends_at, current_period_end, organizations(name), plans(code, name, max_monthly_processes, max_monthly_ai_uses, max_users, max_storage_gb)',
    )
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!subs || subs.length === 0) return []

  const orgIds = subs.map((s) => s.organization_id)

  const [{ data: usageRows }, { data: memberRows }, storageByOrg] = await Promise.all([
    supabase.from('usage_monthly').select('organization_id, metric, value').eq('period', period).in('organization_id', orgIds),
    supabase.from('organization_members').select('organization_id').eq('active', true).in('organization_id', orgIds),
    Promise.all(
      orgIds.map(async (id) => {
        const { data } = await supabase.rpc('org_storage_bytes', { p_organization_id: id })
        return [id, (data ?? 0) / 1024 ** 3] as const
      }),
    ),
  ])

  const storageGbByOrg = new Map(storageByOrg)
  const usersByOrg = new Map<string, number>()
  for (const row of memberRows ?? []) {
    usersByOrg.set(row.organization_id, (usersByOrg.get(row.organization_id) ?? 0) + 1)
  }
  const usageByOrg = new Map<string, { processes: number; aiUses: number }>()
  for (const row of usageRows ?? []) {
    const entry = usageByOrg.get(row.organization_id) ?? { processes: 0, aiUses: 0 }
    if (row.metric === 'processes') entry.processes = row.value
    if (row.metric === 'ai_uses') entry.aiUses = row.value
    usageByOrg.set(row.organization_id, entry)
  }

  return subs
    .filter((s) => s.plans)
    .map((s) => {
      const plan = s.plans!
      const usage = usageByOrg.get(s.organization_id) ?? { processes: 0, aiUses: 0 }
      return {
        organizationId: s.organization_id,
        organizationName: s.organizations?.name ?? null,
        subscriptionId: s.id,
        planId: s.plan_id,
        planCode: plan.code ?? '',
        planName: plan.name ?? '',
        status: s.status,
        billingCycle: s.billing_cycle,
        agreedPriceCents: s.agreed_price_cents,
        trialEndsAt: s.trial_ends_at,
        currentPeriodEnd: s.current_period_end,
        usage: {
          processes: usage.processes,
          aiUses: usage.aiUses,
          users: usersByOrg.get(s.organization_id) ?? 0,
          storageGb: storageGbByOrg.get(s.organization_id) ?? 0,
        },
        limits: {
          maxMonthlyProcesses: plan.max_monthly_processes,
          maxMonthlyAiUses: plan.max_monthly_ai_uses,
          maxUsers: plan.max_users,
          maxStorageGb: plan.max_storage_gb,
        },
      }
    })
}

export async function activateSubscription(subscriptionId: string): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { error } = await supabase
    .from('organization_subscriptions')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/billing')
}

export async function extendSubscription(subscriptionId: string, newPeriodEnd: string): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { error } = await supabase
    .from('organization_subscriptions')
    .update({ current_period_end: newPeriodEnd, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/billing')
}

export async function changeSubscriptionPlan(subscriptionId: string, planId: string): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { error } = await supabase
    .from('organization_subscriptions')
    .update({ plan_id: planId, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/billing')
}

export async function changeAgreedPrice(subscriptionId: string, agreedPriceCents: number | null): Promise<void> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { error } = await supabase
    .from('organization_subscriptions')
    .update({ agreed_price_cents: agreedPriceCents, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/billing')
}

export interface RegisterPaymentInput {
  organizationId: string
  subscriptionId: string
  amountUsdCents: number
  amountCop?: number
  trmUsed?: number
  reference?: string
  invoiceNumber?: string
  periodStart?: string
  periodEnd?: string
  notes?: string
}

/** Registra un pago manual y extiende current_period_end según el ciclo de
 *  facturación de la suscripción (desde la fecha que sea mayor entre hoy y
 *  el vencimiento actual, para no "perder" tiempo ya pagado) — y la pone
 *  'active' si no lo estaba. */
export async function registerPayment(input: RegisterPaymentInput): Promise<void> {
  const profile = await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { data: subscription, error: subError } = await supabase
    .from('organization_subscriptions')
    .select('billing_cycle, current_period_end')
    .eq('id', input.subscriptionId)
    .single()

  if (subError || !subscription) throw new Error(subError?.message ?? 'Suscripción no encontrada')

  const now = new Date()
  const currentEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null
  const base = currentEnd && currentEnd > now ? currentEnd : now
  const newPeriodEnd = new Date(base)
  if (subscription.billing_cycle === 'annual') {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1)
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
  }

  const { error: paymentError } = await supabase.from('subscription_payments').insert({
    organization_id: input.organizationId,
    subscription_id: input.subscriptionId,
    amount_usd_cents: input.amountUsdCents,
    amount_cop: input.amountCop ?? null,
    trm_used: input.trmUsed ?? null,
    reference: input.reference ?? null,
    invoice_number: input.invoiceNumber ?? null,
    period_start: input.periodStart ?? null,
    period_end: input.periodEnd ?? null,
    notes: input.notes ?? null,
    created_by: profile.id,
  })

  if (paymentError) throw new Error(paymentError.message)

  const { error: subUpdateError } = await supabase
    .from('organization_subscriptions')
    .update({ status: 'active', current_period_end: newPeriodEnd.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', input.subscriptionId)

  if (subUpdateError) throw new Error(subUpdateError.message)

  revalidatePath('/admin/billing')
}

export interface PaymentHistoryRow {
  id: string
  amountUsdCents: number
  amountCop: number | null
  trmUsed: number | null
  paidAt: string
  method: string
  reference: string | null
  invoiceNumber: string | null
  periodStart: string | null
  periodEnd: string | null
  notes: string | null
}

export async function getPaymentHistory(subscriptionId: string): Promise<PaymentHistoryRow[]> {
  await requireSuperAdmin()
  const supabase = await createClient({ admin: true })

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('id, amount_usd_cents, amount_cop, trm_used, paid_at, method, reference, invoice_number, period_start, period_end, notes')
    .eq('subscription_id', subscriptionId)
    .order('paid_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({
    id: p.id,
    amountUsdCents: p.amount_usd_cents,
    amountCop: p.amount_cop,
    trmUsed: p.trm_used,
    paidAt: p.paid_at,
    method: p.method,
    reference: p.reference,
    invoiceNumber: p.invoice_number,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    notes: p.notes,
  }))
}
