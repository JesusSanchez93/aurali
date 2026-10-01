'use server'

import { requireAuth, requireOrgAccess } from '@/lib/auth/permissions'
import { getOrgPlan } from '@/lib/billing/getOrgPlan'

/** Código del plan vigente de la organización del usuario actual — usado
 *  por NavUser para decidir si muestra "Mejorar a Pro" (solo en el plan
 *  essential) y el link a Facturación. null para SUPERADMIN sin
 *  organización activa o fuera de un contexto de organización. */
export async function getCurrentUserPlanCode(): Promise<string | null> {
  const profile = await requireAuth()
  if (!profile.current_organization_id || profile.system_role === 'SUPERADMIN') return null

  await requireOrgAccess(profile.current_organization_id)
  const plan = await getOrgPlan(profile.current_organization_id)
  return plan.plan.code
}
