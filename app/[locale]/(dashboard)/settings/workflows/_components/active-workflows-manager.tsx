'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Plus, Workflow, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Sheet from '@/components/common/sheet'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import type { WorkflowEdge, WorkflowNode } from '@/components/app/workflow-editor/types'
import { activateWorkflowForOrg, deactivateWorkflowForOrg, getWorkflowGraphForOrgAdmin, updateEmailNodeConfig } from '../actions'

type WorkflowTemplate = { id: string; name: string; description: string | null; is_legacy_form: boolean }
type AvailableWorkflow = { id: string; name: string; description: string | null; is_default: boolean; icon_svg: string | null }

interface Props {
  activeTemplates: WorkflowTemplate[]
  availableToActivate: AvailableWorkflow[]
  title: string
  description: string
}

export function ActiveWorkflowsManager({ activeTemplates, availableToActivate, title, description }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(activeTemplates[0]?.id ?? null)
  const [graph, setGraph] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null>(null)
  const [loadingGraph, setLoadingGraph] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const selected = activeTemplates.find((t) => t.id === selectedId) ?? activeTemplates[0]

  useEffect(() => {
    if (!selected) return
    setLoadingGraph(true)
    getWorkflowGraphForOrgAdmin(selected.id)
      .then(setGraph)
      .finally(() => setLoadingGraph(false))
  }, [selected])

  function handleActivate(id: string) {
    startTransition(async () => {
      try {
        await activateWorkflowForOrg(id)
        toast.success('Tipo de proceso agregado')
        setAddOpen(false)
        setSelectedId(id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al agregar')
      }
    })
  }

  function handleDeactivate(id: string) {
    startTransition(async () => {
      try {
        await deactivateWorkflowForOrg(id)
        toast.success('Tipo de proceso desactivado')
        if (selectedId === id) setSelectedId(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al desactivar')
      }
    })
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {availableToActivate.length > 0 && (
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar tipo de proceso
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {activeTemplates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setSelectedId(tpl.id)}
            className={cn(
              'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              selected?.id === tpl.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            <Workflow className="h-3.5 w-3.5" />
            {tpl.name}
            {tpl.is_legacy_form && (
              <Badge variant="secondary" className="text-[10px]">Legado</Badge>
            )}
            {activeTemplates.length > 1 && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeactivate(tpl.id)
                }}
                className="ml-1 rounded-full p-0.5 opacity-0 hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{selected.name}</CardTitle>
            {selected.description && <CardDescription>{selected.description}</CardDescription>}
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[calc(100vh-22rem)] overflow-hidden rounded-b-lg">
              {loadingGraph || !graph ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <WorkflowEditor
                  templateId={selected.id}
                  templateName={selected.name ?? ''}
                  initialNodes={graph.nodes}
                  initialEdges={graph.edges}
                  readOnly
                  backHref="/settings/workflows"
                  onNodeEdit={updateEmailNodeConfig}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar tipo de proceso"
        description="Activa un tipo de proceso adicional para tu organización."
        body={
          <div className="space-y-2 p-4 pt-0">
            {availableToActivate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay más tipos de proceso disponibles.</p>
            ) : (
              availableToActivate.map((wf) => (
                <div key={wf.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{wf.name}</p>
                    {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
                  </div>
                  <Button size="sm" disabled={isPending} onClick={() => handleActivate(wf.id)}>
                    {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Activar
                  </Button>
                </div>
              ))
            )}
          </div>
        }
      />
    </div>
  )
}
