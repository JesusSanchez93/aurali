import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.users') };
}
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getOrgMembers, getPendingInvitations } from './actions';
import { getAssignableRoles } from '../roles/actions';
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

  const can = (permission: string) => profile.permissions.includes(permission);
  if (!can('users.view')) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  const [members, invitations, roles] = await Promise.all([
    getOrgMembers(),
    getPendingInvitations(),
    getAssignableRoles(),
  ]);

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <p className="text-sm text-muted-foreground">
          Administra los miembros de tu organización, sus roles y las invitaciones.
        </p>
      </div>
      <UsersSection
        initialMembers={members}
        initialInvitations={invitations}
        currentUserId={profile.id}
        roles={roles}
        canInvite={can('users.create')}
        canUpdate={can('users.update')}
        canDelete={can('users.delete')}
      />
    </div>
  );
}
