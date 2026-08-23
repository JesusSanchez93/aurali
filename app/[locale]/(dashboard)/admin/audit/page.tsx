import { getAuditLogs, getAllOrganizationsForAudit } from './actions'
import { AuditLogTable } from './_components/audit-log-table'
import { ShieldAlert } from 'lucide-react'

export default async function AdminAuditPage() {
  const [logs, organizations] = await Promise.all([
    getAuditLogs({ days: 30 }),
    getAllOrganizationsForAudit(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Auditoría</h1>
          <p className="text-sm text-muted-foreground">
            Rastro de acciones de clientes, personal y el sistema — últimos 30 días por defecto.
          </p>
        </div>
      </div>

      <AuditLogTable initialLogs={logs} organizations={organizations} />
    </div>
  )
}
