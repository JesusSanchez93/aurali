'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowRight, Workflow as WorkflowIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { selectWorkflowForOrg } from './actions'
import { toast } from 'sonner'

type WorkflowOption = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  icon_svg: string | null
}

interface Props {
  workflows: WorkflowOption[]
}

export function WorkflowSelectionForm({ workflows }: Props) {
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
        router.push('/dashboard')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al seleccionar el flujo')
      }
    })
  }

  return (
    <div className="w-full max-w-screen-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Paso 5 · Flujo
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Selecciona un flujo de trabajo</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Elige el flujo que define los pasos para completar un proceso legal en tu organización.
          Podrás cambiarlo después en Configuración.
        </p>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <WorkflowIcon className="mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">No hay flujos disponibles aún.</p>
          <p className="mt-1 text-xs">El administrador del sistema configurará un flujo pronto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {workflows.map((wf) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => { if (selected !== wf.id) setSelected(wf.id) }}
              className={cn(
                'group w-full rounded-lg border p-4 text-left transition-all duration-150',
                selected === wf.id
                  ? 'border-foreground bg-foreground/[0.03]'
                  : 'border-border hover:border-foreground/30 hover:bg-muted/40',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    {wf.icon_svg ? (
                      <span
                        className="flex h-4 w-4 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: wf.icon_svg }}
                      />
                    ) : (
                      <WorkflowIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{wf.name}</span>
                    {wf.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{wf.description}</p>
                    )}
                  </div>
                </div>
                <CheckCircle2
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0 transition-opacity',
                    selected === wf.id ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {workflows.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-8 flex justify-end bg-background/80 py-4 backdrop-blur-sm">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={handleConfirm}
            disabled={!selected || isPending}
          >
            {isPending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
