import { getAllClients } from './actions'
import { ClientsList } from './_components/clients-list'
import { Users } from 'lucide-react'

export default async function AdminClientsPage() {
  const clients = await getAllClients()

  return (
    <div className="flex flex-col gap-6 p-6">
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
