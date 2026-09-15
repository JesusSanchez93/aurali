import { getAllClients, getPendingOrganizations } from './actions'
import { ClientsList } from './_components/clients-list'
import { PendingRequestsList } from './_components/pending-requests-list'
import { Users } from 'lucide-react'

export default async function AdminClientsPage() {
  const [clients, pendingOrgs] = await Promise.all([getAllClients(), getPendingOrganizations()])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <PendingRequestsList orgs={pendingOrgs} />

      <div className="flex items-center gap-3">
        <Users className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
          </p>
        </div>
      </div>

      <ClientsList clients={clients} />
    </div>
  )
}
