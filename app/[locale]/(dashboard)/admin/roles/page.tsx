import { getTranslations } from 'next-intl/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSystemRolesOverview } from './actions';
import { SystemRolesSection } from './_components/system-roles-section';
import { PermissionsSection } from './_components/permissions-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.admin_roles') };
}

export default async function AdminRolesPage() {
  const { roles, permissions } = await getSystemRolesOverview();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles y permisos</h1>
        <p className="text-sm text-muted-foreground">
          Roles oficiales de Aurali y el catálogo de permisos que usan todas las organizaciones.
        </p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <SystemRolesSection roles={roles} permissions={permissions.filter((p) => p.isActive)} />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsSection permissions={permissions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
