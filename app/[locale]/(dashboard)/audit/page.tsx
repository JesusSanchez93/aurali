import { getTranslations } from 'next-intl/server';
import { getAuditLogs } from '../admin/audit/actions';
import { AuditLogTable } from '../admin/audit/_components/audit-log-table';
import { ShieldAlert } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('nav.admin_audit') };
}

export default async function OrgAuditPage() {
  const logs = await getAuditLogs({ days: 30 });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Rastro de acciones de clientes, personal y el sistema en tu organización — últimos 30 días por defecto.
          </p>
        </div>
      </div>

      <AuditLogTable initialLogs={logs} organizations={[]} />
    </div>
  );
}
