export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled'
export type BillingCycle = 'monthly' | 'annual'
export type UsageMetric = 'processes' | 'ai_uses' | 'emails'
export type LimitLevel = 'ok' | 'warn80' | 'over'

export interface OrgPlan {
  subscriptionId: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  agreedPriceCents: number | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  plan: {
    id: string
    code: string
    name: string
    priceMonthlyCents: number | null
    listPriceMonthlyCents: number | null
    maxUsers: number | null
    maxMonthlyProcesses: number | null
    maxStorageGb: number | null
    maxWorkflows: number | null
    maxMonthlyAiUses: number | null
    features: Partial<Record<PlanFeature, boolean>>
  }
}

/** Features de plan guardadas en `plans.features` (json). */
export type PlanFeature = 'custom_roles'

export interface OrgUsage {
  processes: number
  aiUses: number
  emails: number
  storageGb: number
  users: number
}

export interface LimitCheck {
  allowed: boolean
  used: number
  limit: number | null
  level: LimitLevel
}
