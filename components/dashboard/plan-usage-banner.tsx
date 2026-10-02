import { TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getOrgPlan } from '@/lib/billing/getOrgPlan';
import { getUsage } from '@/lib/billing/usage';
import type { SessionProfile } from '@/lib/auth/get-session-profile';

interface Props {
  profile: SessionProfile;
}

const GRACE_PERIOD_DAYS = 7;
const EXPIRY_WARNING_DAYS = 7;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Aviso persistente de plan — da prioridad a lo más urgente: vencido en
 *  gracia > por vencer en ≤7 días > uso cercano al límite (procesos,
 *  usuarios, almacenamiento — NUNCA uso de IA, que no se expone al
 *  cliente). No se muestra durante el onboarding. */
export async function PlanUsageBanner({ profile }: Props) {
  if (!profile.current_organization_id || profile.onboarding_status !== 'completed') {
    return null;
  }

  const orgId = profile.current_organization_id;
  const [t, plan, usage] = await Promise.all([
    getTranslations('dashboard.plan_usage_banner'),
    getOrgPlan(orgId),
    getUsage(orgId),
  ]);

  let message: string | null = null;

  if ((plan.status === 'past_due' || plan.status === 'canceled') && plan.currentPeriodEnd) {
    const elapsed = daysSince(plan.currentPeriodEnd);
    const remaining = GRACE_PERIOD_DAYS - elapsed;
    if (remaining >= 0) {
      message = t('expired_message', { days: remaining });
    }
  } else if (plan.status === 'trial' && plan.trialEndsAt) {
    const remaining = daysUntil(plan.trialEndsAt);
    if (remaining >= 0 && remaining <= EXPIRY_WARNING_DAYS) {
      message = t('expiring_message', { date: new Date(plan.trialEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) });
    }
  } else if (plan.status === 'active' && plan.currentPeriodEnd) {
    const remaining = daysUntil(plan.currentPeriodEnd);
    if (remaining >= 0 && remaining <= EXPIRY_WARNING_DAYS) {
      message = t('expiring_message', { date: new Date(plan.currentPeriodEnd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) });
    }
  }

  if (!message) {
    const checks: [string, number, number | null][] = [
      ['procesos', usage.processes, plan.plan.maxMonthlyProcesses],
      ['usuarios', usage.users, plan.plan.maxUsers],
      ['almacenamiento', usage.storageGb, plan.plan.maxStorageGb],
    ];
    const nearLimit = checks.find(([, used, limit]) => limit !== null && used >= limit * 0.8);
    if (nearLimit) message = t('usage_message', { metric: nearLimit[0] });
  }

  if (!message) return null;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 bg-amber-400 px-4 shadow-sm md:px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-amber-950">
        <TriangleAlert className="size-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      <Link
        href="/billing"
        className="shrink-0 rounded-md border border-amber-700/40 bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
