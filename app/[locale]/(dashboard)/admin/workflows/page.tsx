import { Plus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { getGlobalWorkflows } from './actions'
import { WorkflowCard } from './_components/workflow-card'

export default async function AdminWorkflowsPage() {
  const workflows = await getGlobalWorkflows()

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Flujos de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los flujos globales disponibles para todas las organizaciones.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/workflows/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo flujo
          </Link>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
          <Workflow className="mb-4 h-10 w-10 opacity-30" />
          <p className="text-sm">No hay flujos globales creados.</p>
          <p className="mt-1 text-xs">Crea un flujo para que las organizaciones puedan seleccionarlo.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <WorkflowCard key={wf.id} wf={wf} />
          ))}
        </div>
      )}
    </div>
  )
}
