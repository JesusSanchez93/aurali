'use client'

import { useEffect, useState, useTransition } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Check, Eye, Loader2, Plus, Trash2, Workflow, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Sheet from '@/components/common/sheet'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { sanitizeSvg } from '@/lib/sanitize-svg'
import { WorkflowTypeCard } from './workflow-type-card'
import { WorkflowEditor } from '@/components/app/workflow-editor/WorkflowEditor'
import type { WorkflowEdge, WorkflowNode } from '@/components/app/workflow-editor/types'
import { activateWorkflowForOrg, deactivateWorkflowForOrg, getWorkflowGraphForOrgAdmin, updateEmailNodeConfig } from '../actions'

const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 16 : -16, opacity: 0, pointerEvents: 'none' }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto', transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
  exit: (dir: number) => ({ x: dir > 0 ? -16 : 16, opacity: 0, pointerEvents: 'none', transition: { duration: 0.14, ease: 'easeIn' } }),
}

type WorkflowTemplate = {
  id: string
  name: string
  description: string | null
  is_legacy_form: boolean
  icon_svg: string | null
  gradient_color: string | null
  gradient_color_to: string | null
}
type AvailableWorkflow = { id: string; name: string; description: string | null; is_default: boolean; icon_svg: string | null; gradient_color: string | null; gradient_color_to: string | null }

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
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [isPending, startTransition] = useTransition()

  const selected = activeTemplates.find((t) => t.id === selectedId) ?? activeTemplates[0]

  useEffect(() => {
    if (!selected) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingGraph(true)
    getWorkflowGraphForOrgAdmin(selected.id)
      .then(setGraph)
      .finally(() => setLoadingGraph(false))
  }, [selected])

  useEffect(() => {
    if (!confirmId) return
    function reset() {
      setDirection(-1)
      setConfirmId(null)
    }
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(`[data-chip-id="${confirmId}"]`)) reset()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') reset()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [confirmId])

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
        setConfirmId(null)
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
        {activeTemplates.map((tpl) => {
          const from = tpl.gradient_color ?? '#7c3aed'
          const to = tpl.gradient_color_to ?? '#0ea5e9'
          const isSelected = selected?.id === tpl.id
          const isConfirming = confirmId === tpl.id
          return (
            <button
              key={tpl.id}
              type="button"
              data-chip-id={tpl.id}
              onClick={() => setSelectedId(tpl.id)}
              style={
                isConfirming
                  ? undefined
                  : {
                      background: `linear-gradient(135deg, ${from}${isSelected ? '26' : '12'} 0%, ${to}${isSelected ? '18' : '0a'} 100%)`,
                      borderColor: isSelected ? `${from}80` : undefined,
                    }
              }
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-all duration-300',
                isConfirming
                  ? 'border-destructive/40 bg-gradient-to-r from-destructive/25 via-destructive/10 to-transparent text-destructive'
                  : isSelected
                    ? 'shadow-sm'
                    : 'hover:shadow-sm',
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 ring-1 ring-white/50 dark:bg-white/10"
                style={{ color: from }}
              >
                {tpl.icon_svg ? (
                  <span
                    className="flex h-4 w-4 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(tpl.icon_svg) }}
                  />
                ) : (
                  <Workflow className="h-4 w-4" />
                )}
              </span>
              {tpl.name}
              {tpl.is_legacy_form && (
                <Badge variant="secondary" className="text-[10px]">Legado</Badge>
              )}
              {activeTemplates.length > 1 && (
                <span className="relative -mr-1.5 flex h-7 w-[60px] items-center justify-end overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    {isConfirming ? (
                      <motion.span
                        key="confirm"
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex items-center gap-0.5"
                      >
                        <span
                          role="button"
                          tabIndex={-1}
                          title="Confirmar"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeactivate(tpl.id)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/20"
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </span>
                        <span
                          role="button"
                          tabIndex={-1}
                          title="Cancelar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDirection(-1)
                            setConfirmId(null)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex items-center"
                      >
                        <span
                          role="button"
                          tabIndex={-1}
                          title="Desactivar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDirection(1)
                            setConfirmId(tpl.id)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg opacity-0 hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <Card className="overflow-hidden lg:flex">
          <CardHeader className="pb-3 lg:w-72 lg:shrink-0 lg:border-r lg:pb-6">
            <CardTitle className="text-base">{selected.name}</CardTitle>
            {selected.description && <CardDescription>{selected.description}</CardDescription>}
            {graph && (
              <div className="hidden flex-col items-start gap-2 pt-3 lg:flex">
                <Badge variant="secondary">{graph.nodes.length} nodos</Badge>
                <Badge variant="secondary">{graph.edges.length} conexiones</Badge>
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Solo lectura
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0 lg:min-w-0 lg:flex-1">
            <div className="h-[max(32rem,calc(100vh-16rem))] overflow-hidden rounded-b-lg lg:h-[calc(100vh-11rem)] lg:rounded-none">
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
                  headerClassName="lg:hidden"
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
          <div className="p-4 pt-0">
            {availableToActivate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay más tipos de proceso disponibles.</p>
            ) : (
              <div className="space-y-2">
                {availableToActivate.map((wf, i) => (
                  <WorkflowTypeCard
                    key={wf.id}
                    wf={wf}
                    index={i}
                    disabled={isPending}
                    onActivate={() => handleActivate(wf.id)}
                  />
                ))}
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}
