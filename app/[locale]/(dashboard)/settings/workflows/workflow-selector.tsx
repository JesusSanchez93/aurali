'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowRight, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectWorkflowForOrg } from '@/app/[locale]/onboarding/workflow-selection/actions'
import { toast } from 'sonner'

type WorkflowOption = {
  id: string
  name: string
  description: string | null
  is_default: boolean
}

interface Props {
  workflows: WorkflowOption[]
}

export function WorkflowSelector({ workflows }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(
    workflows.find((w) => w.is_default)?.id ?? workflows[0]?.id ?? null,
  )
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!selected) return
    startTransition(async () => {
      try {
        await selectWorkflowForOrg(selected)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al seleccionar el flujo')
      }
    })
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-screen-sm space-y-6">
        <div className="text-center">
          <Workflow className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <h2 className="text-lg font-medium">Sin flujo seleccionado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu organización aún no tiene un flujo de trabajo asignado.
          </p>
        </div>

        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="text-sm">No hay flujos disponibles aún.</p>
            <p className="mt-1 text-xs">El administrador del sistema configurará un flujo pronto.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => setSelected(wf.id)}
                className={cn(
                  'group w-full rounded-lg border p-4 text-left transition-all',
                  selected === wf.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wf.name}</span>
                      {wf.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Recomendado
                        </Badge>
                      )}
                    </div>
                    {wf.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{wf.description}</p>
                    )}
                  </div>
                  <CheckCircle2
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 transition-opacity',
                      selected === wf.id ? 'text-primary opacity-100' : 'opacity-0',
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        {workflows.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button onClick={handleConfirm} disabled={!selected || isPending}>
              Confirmar selección
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
