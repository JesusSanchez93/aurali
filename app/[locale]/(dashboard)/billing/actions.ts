'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireOrgAdmin } from '@/lib/auth/permissions'
import { getOrgPlan } from '@/lib/billing/getOrgPlan'
import { getUsage } from '@/lib/billing/usage'
import type { OrgPlan, OrgUsage } from '@/lib/billing/types'

async function getOrgContext() {
  const [supabase, profile] = await Promise.all([createClient(), requireAuth()])
  const orgId = profile.current_organization_id
  if (!orgId) throw new Error('No organization')
  await requireOrgAdmin(orgId)
  return { supabase, orgId }
}

export interface BillingTransferInfo {
  bankName: string
  accountType: string
  accountNumber: string
  accountHolder: string
  contactEmail: string
}

/** null si falta cualquiera de las variables BILLING_* — el bloque de datos
 *  de transferencia se oculta por completo en ese caso (nunca a medias). */
export async function getBillingTransferInfo(): Promise<BillingTransferInfo | null> {
  const bankName = process.env.BILLING_BANK_NAME
  const accountType = process.env.BILLING_ACCOUNT_TYPE
  const accountNumber = process.env.BILLING_ACCOUNT_NUMBER
  const accountHolder = process.env.BILLING_ACCOUNT_HOLDER
  const contactEmail = process.env.BILLING_CONTACT_EMAIL

  if (!bankName || !accountType || !accountNumber || !accountHolder || !contactEmail) return null

  return { bankName, accountType, accountNumber, accountHolder, contactEmail }
}

export interface BillingOverview {
  plan: OrgPlan
  usage: OrgUsage
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const { orgId } = await getOrgContext()
  const [plan, usage] = await Promise.all([getOrgPlan(orgId), getUsage(orgId)])
  return { plan, usage }
}

export interface PaymentHistoryRow {
  id: string
  amountUsdCents: number
  paidAt: string
  method: string
  invoiceNumber: string | null
  periodStart: string | null
  periodEnd: string | null
}

export async function getOrgPaymentHistory(): Promise<PaymentHistoryRow[]> {
  const { supabase, orgId } = await getOrgContext()

  const { data, error } = await supabase
    .from('subscription_payments')
    .select('id, amount_usd_cents, paid_at, method, invoice_number, period_start, period_end')
    .eq('organization_id', orgId)
    .order('paid_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({
    id: p.id,
    amountUsdCents: p.amount_usd_cents,
    paidAt: p.paid_at,
    method: p.method,
    invoiceNumber: p.invoice_number,
    periodStart: p.period_start,
    periodEnd: p.period_end,
  }))
}
