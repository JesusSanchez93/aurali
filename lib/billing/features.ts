import { getOrgPlan } from './getOrgPlan'
import type { PlanFeature } from './types'

/**
 * Único punto de la app donde se decide si el plan de una organización
 * incluye una feature. La misma regla vive en Postgres
 * (`org_plan_has_feature`) para que RLS la haga cumplir aunque se llame a
 * Supabase directamente.
 */
export async function planHasFeature(organizationId: string, feature: PlanFeature): Promise<boolean> {
  const orgPlan = await getOrgPlan(organizationId)
  return orgPlan.plan.features[feature] === true
}
