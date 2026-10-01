import { startOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getOrgPlan } from './getOrgPlan'
import type { LimitCheck, OrgUsage, UsageMetric } from './types'

function currentPeriod(): string {
  return startOfMonth(new Date()).toISOString().slice(0, 10)
}

/**
 * Uso del mes en curso: procesos/IA/correos desde `usage_monthly`;
 * almacenamiento (bucket `documents`, prefijo `{organizationId}/`) y
 * usuarios activos se calculan en vivo, no se acumulan en `usage_monthly`.
 */
export async function getUsage(organizationId: string): Promise<OrgUsage> {
  const supabase = await createClient({ admin: true })
  const period = currentPeriod()

  const [{ data: usageRows }, { count: usersCount }, { data: storageBytes }] = await Promise.all([
    supabase
      .from('usage_monthly')
      .select('metric, value')
      .eq('organization_id', organizationId)
      .eq('period', period),
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase.rpc('org_storage_bytes', { p_organization_id: organizationId }),
  ])

  const byMetric = new Map((usageRows ?? []).map((row) => [row.metric, row.value]))

  return {
    processes: byMetric.get('processes') ?? 0,
    aiUses: byMetric.get('ai_uses') ?? 0,
    emails: byMetric.get('emails') ?? 0,
    storageGb: (storageBytes ?? 0) / 1024 ** 3,
    users: usersCount ?? 0,
  }
}

/**
 * Incrementa un contador de uso de forma atómica vía la función RPC
 * `increment_usage` (SECURITY DEFINER, solo ejecutable por service_role).
 */
export async function incrementUsage(organizationId: string, metric: UsageMetric, n = 1): Promise<void> {
  const supabase = await createClient({ admin: true })

  const { error } = await supabase.rpc('increment_usage', {
    p_organization_id: organizationId,
    p_period: currentPeriod(),
    p_metric: metric,
    p_n: n,
  })

  if (error) {
    throw new Error(`No se pudo incrementar el uso de "${metric}": ${error.message}`)
  }
}

function levelFor(used: number, limit: number | null): LimitCheck['level'] {
  if (limit === null) return 'ok'
  if (used >= limit) return 'over'
  if (used >= limit * 0.8) return 'warn80'
  return 'ok'
}

/**
 * Compara el uso actual contra el límite del plan para una métrica.
 * `limit: null` significa ilimitado (siempre `allowed: true`, `level: 'ok'`).
 */
export async function checkLimit(organizationId: string, metric: UsageMetric | 'storage' | 'users'): Promise<LimitCheck> {
  const [orgPlan, usage] = await Promise.all([getOrgPlan(organizationId), getUsage(organizationId)])

  const { used, limit } = (() => {
    switch (metric) {
      case 'processes':
        return { used: usage.processes, limit: orgPlan.plan.maxMonthlyProcesses }
      case 'ai_uses':
        return { used: usage.aiUses, limit: orgPlan.plan.maxMonthlyAiUses }
      case 'emails':
        return { used: usage.emails, limit: null }
      case 'storage':
        return { used: usage.storageGb, limit: orgPlan.plan.maxStorageGb }
      case 'users':
        return { used: usage.users, limit: orgPlan.plan.maxUsers }
    }
  })()

  return {
    allowed: limit === null || used < limit,
    used,
    limit,
    level: levelFor(used, limit),
  }
}
