import { Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getEmailProvider } from '@/lib/email/connection';
import type { SessionProfile } from '@/lib/auth/get-session-profile';

interface Props {
  profile: SessionProfile;
}

/** Aviso persistente mientras la organización no tenga correo propio
 *  conectado — los correos a clientes no pueden salir de Aurali (ver
 *  lib/email/sendOrgEmail.ts, opción `strict`). No se muestra durante el
 *  onboarding (profile.onboarding_status !== 'completed') ni para
 *  superadmins sin organización activa. */
export async function EmailConnectionBanner({ profile }: Props) {
  if (!profile.current_organization_id || profile.onboarding_status !== 'completed') {
    return null;
  }

  const [t, provider] = await Promise.all([
    getTranslations('dashboard.email_connection_banner'),
    getEmailProvider(profile.current_organization_id),
  ]);

  if (provider !== 'aurali') return null;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 bg-amber-400 px-4 shadow-sm md:px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-amber-950">
        <Mail className="size-4 shrink-0" />
        <span className="truncate">{t('message')}</span>
      </div>
      <Link
        href="/settings/email"
        className="shrink-0 rounded-md border border-amber-700/40 bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-200"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
