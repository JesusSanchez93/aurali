import { getGoogleDocTemplates, getGoogleConnectionStatus } from './actions';
import { GoogleTemplatesSection } from './_components/google-templates-section';
import { VARIABLE_GROUPS } from '@/app/[locale]/(dashboard)/settings/document-templates/_components/variables';
import { GoogleSetupGuide } from './_components/google-setup-guide';
import { GoogleConnection } from '@/components/app/settings/google-connection';
import { getSessionProfile } from '@/lib/auth/get-session-profile';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ google?: string }>;
}

export default async function GoogleTemplatesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { google } = await searchParams;

  const [templates, connection, { profile }] = await Promise.all([
    getGoogleDocTemplates(),
    getGoogleConnectionStatus(),
    getSessionProfile(),
  ]);

  const isSuperAdmin = profile?.system_role === 'SUPERADMIN';

  // Verificar en el servidor si las credenciales OAuth están configuradas
  const credentialsConfigured = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Google Docs</h1>
        <p className="text-sm text-muted-foreground">
          Conecta tu cuenta de Google y gestiona plantillas basadas en Google Docs.
        </p>
      </div>

      {/* Guía de configuración */}
      <GoogleSetupGuide credentialsConfigured={credentialsConfigured} isSuperAdmin={isSuperAdmin} />

      {/* Estado de conexión */}
      <GoogleConnection
        connected={connection.connected}
        email={connection.email}
        locale={locale}
        disabled={!credentialsConfigured}
      />

      {/* Feedback del flujo OAuth */}
      {google === 'connected' && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Cuenta de Google conectada correctamente.
        </div>
      )}
      {google === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Error al conectar la cuenta de Google. Verifica que las credenciales estén bien configuradas e inténtalo de nuevo.
        </div>
      )}
      {google === 'cancelled' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Conexión cancelada.
        </div>
      )}

      {/* Tabla de plantillas */}
      <GoogleTemplatesSection
        templates={templates}
        connection={connection}
        locale={locale}
        variableGroups={VARIABLE_GROUPS}
      />
    </div>
  );
}
