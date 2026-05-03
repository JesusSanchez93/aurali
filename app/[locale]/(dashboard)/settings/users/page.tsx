import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.users') };
}
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getOrgMembers, getPendingInvitations } from './actions';
import { UsersSection } from './_components/users-section';

export default async function UsersPage() {
  const { profile } = await getSessionProfile();
  if (!profile) redirect('/auth/login');

  const orgId = profile.current_organization_id;
  if (!orgId) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">No tienes una organización activa.</p>
      </div>
    );
  }

  // Check ORG_ADMIN role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const { data: membership } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', profile.id)
    .single();

  const isAdmin = profile.system_role === 'SUPERADMIN' || membership?.role === 'ORG_ADMIN';
  if (!isAdmin) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  const [members, invitations] = await Promise.all([
    getOrgMembers(),
    getPendingInvitations(),
  ]);

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Administra los usuarios de tu organización e invita a nuevos miembros.
        </p>
      </div>
      <UsersSection
        initialMembers={members}
        initialInvitations={invitations}
        currentUserId={profile.id}
      />
    </div>
  );
}
