/**
 * GET /api/cron/billing-reminders
 *
 * Cron diario: recorre las suscripciones activas/en prueba y:
 *   1. Envía un recordatorio por correo (Aurali/Resend) a los admins de la
 *      organización 7 días antes del vencimiento y el día que vence —
 *      registrado en billing_reminder_log para no duplicar envíos.
 *   2. Marca 'past_due' cualquier suscripción cuyo periodo ya venció.
 *
 * Auth: mismo patrón que los demás crons — Authorization: Bearer $CRON_SECRET.
 */

import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { createClient } from '@/lib/supabase/server';
import { resend } from '@/lib/resend';
import { BillingReminderEmail } from '@/emails/BillingReminderEmail';
import { createLogger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('CRON:BILLING_REMINDERS');

interface SubscriptionRow {
  id: string;
  organization_id: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  organizations: { name: string | null } | null;
  plans: { name: string | null } | null;
}

/** Diferencia en días de calendario (UTC), no en milisegundos exactos — así
 *  el resultado no depende de la hora del día en que corre el cron. */
function daysUntil(iso: string, now: Date): number {
  const expiryMidnight = Date.UTC(new Date(iso).getUTCFullYear(), new Date(iso).getUTCMonth(), new Date(iso).getUTCDate());
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((expiryMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const supabase = await createClient({ admin: true });
  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data: subscriptions, error } = await supabase
    .from('organization_subscriptions')
    .select('id, organization_id, status, trial_ends_at, current_period_end, organizations(name), plans(name)')
    .in('status', ['trial', 'active']);

  if (error) {
    logger.error('Failed to load subscriptions', undefined, { errorMessage: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let remindersSent = 0;
  let markedPastDue = 0;
  let failed = 0;

  for (const sub of (subscriptions ?? []) as unknown as SubscriptionRow[]) {
    try {
      const expiryIso = sub.status === 'trial' ? sub.trial_ends_at : sub.current_period_end;
      if (!expiryIso) continue; // sin vencimiento (orgs internas/de prueba) — nunca recordatorio ni past_due

      const remaining = daysUntil(expiryIso, now);

      if (remaining < 0) {
        const { error: updateErr } = await supabase
          .from('organization_subscriptions')
          .update({ status: 'past_due', updated_at: now.toISOString() })
          .eq('id', sub.id);
        if (updateErr) throw new Error(updateErr.message);
        markedPastDue++;
        continue;
      }

      const reminderType = remaining === 0 ? 'due_today' : remaining === 7 ? '7_days' : null;
      if (!reminderType) continue;

      const { data: alreadySent } = await supabase
        .from('billing_reminder_log')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('reminder_type', reminderType)
        .eq('period_end', expiryIso)
        .maybeSingle();
      if (alreadySent) continue;

      const { data: admins } = await supabase
        .from('organization_members')
        .select('profiles(email)')
        .eq('organization_id', sub.organization_id)
        .eq('role', 'ORG_ADMIN')
        .eq('active', true);

      const recipients = (admins ?? [])
        .map((m) => (m.profiles as unknown as { email: string | null } | null)?.email)
        .filter((email): email is string => !!email);

      if (recipients.length > 0) {
        const html = await render(
          BillingReminderEmail({
            companyName: sub.organizations?.name ?? 'tu organización',
            planName: sub.plans?.name ?? 'tu plan',
            dueToday: reminderType === 'due_today',
            periodEndLabel: new Date(expiryIso).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
            billingUrl: `${appUrl}/es/billing`,
          }) as React.ReactElement,
        );

        await resend.emails.send({
          from: 'Aurali <noreply@aurali.app>',
          to: recipients,
          subject: reminderType === 'due_today' ? 'Tu suscripción a Aurali vence hoy' : 'Tu suscripción a Aurali vence en 7 días',
          html,
        });
      }

      const { error: logErr } = await supabase
        .from('billing_reminder_log')
        .insert({ subscription_id: sub.id, reminder_type: reminderType, period_end: expiryIso });
      if (logErr) throw new Error(logErr.message);

      remindersSent++;
    } catch (err) {
      failed++;
      logger.error('Error procesando recordatorio de facturación', err, { subscriptionId: sub.id });
    }
  }

  logger.info('Billing reminders cron run complete', {
    subscriptions: subscriptions?.length ?? 0,
    remindersSent,
    markedPastDue,
    failed,
  });
  return NextResponse.json({ subscriptions: subscriptions?.length ?? 0, remindersSent, markedPastDue, failed });
}
