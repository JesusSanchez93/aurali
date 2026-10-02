import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth/get-session-profile';
import { getOrgRolesOverview } from './actions';
import { RolesSection } from './_components/roles-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.roles') };
}

export default async function RolesPage() {
  const { profile } = await getSessionProfile();
  if (!profile) redirect('/auth/login');

  if (!profile.current_organization_id || !profile.permissions.includes('roles.manage')) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  const overview = await getOrgRolesOverview();

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles</h1>
        <p className="text-sm text-muted-foreground">
          Define qué puede hacer cada miembro de tu equipo.
        </p>
      </div>
      <RolesSection overview={overview} />
    </div>
  );
}
