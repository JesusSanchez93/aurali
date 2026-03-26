import { Plus, Workflow, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from '@/i18n/routing'
import { getGlobalWorkflows, deleteGlobalWorkflow } from './actions'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

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
            <Card key={wf.id} className="group flex flex-col">
              <CardHeader className="flex-1 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{wf.name}</CardTitle>
                    {wf.description && (
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {wf.description}
                      </CardDescription>
                    )}
                  </div>
                  {wf.is_default && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Por defecto
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Creado{' '}
                  {formatDistanceToNow(new Date(wf.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/admin/workflows/${wf.id}/builder`}>
                    <Workflow className="mr-2 h-3.5 w-3.5" />
                    Abrir editor
                  </Link>
                </Button>
                <form
                  action={async () => {
                    'use server'
                    await deleteGlobalWorkflow(wf.id)
                  }}
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
