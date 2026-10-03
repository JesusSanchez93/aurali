import { Plus, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/routing'
import { getGlobalWorkflows } from './actions'
import { WorkflowCard } from './_components/workflow-card'
import { ImportWorkflowButton } from './_components/import-workflow-button'

export default async function AdminWorkflowsPage() {
  const workflows = await getGlobalWorkflows()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-6">
      {/* Si no caben lado a lado, las acciones bajan a su propia línea. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-semibold">Flujos de trabajo</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los flujos globales disponibles para todas las organizaciones.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ImportWorkflowButton />
          <Button asChild>
            <Link href="/admin/workflows/new">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo flujo
            </Link>
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
          <Workflow className="mb-4 h-10 w-10 opacity-30" />
          <p className="text-sm">No hay flujos globales creados.</p>
          <p className="mt-1 text-xs">Crea un flujo para que las organizaciones puedan seleccionarlo.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-stretch gap-4">
          {workflows.map((wf, index) => (
            <WorkflowCard key={wf.id} wf={wf} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}
