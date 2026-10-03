'use client'

import { useState, useTransition } from 'react'
import { useRouter, Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowLeft, ArrowRight, Workflow as WorkflowIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { selectWorkflowsForOrg } from './actions'
import { sanitizeSvg } from '@/lib/sanitize-svg'
import { toast } from '@/lib/toast'
import { ORG_CATALOGS, isProcessCatalogKey } from '@/lib/catalogs/registry'

type WorkflowOption = {
  id: string
  name: string
  description: string | null
  required_catalogs: string[]
  icon_svg: string | null
}

interface Props {
  workflows: WorkflowOption[]
  planName: string
  /** Tope de flujos activos del plan; `null` = sin límite. */
  maxWorkflows: number | null
}

export function WorkflowSelectionForm({ workflows, planName, maxWorkflows }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const limitReached = maxWorkflows !== null && selected.length >= maxWorkflows

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (maxWorkflows !== null && prev.length >= maxWorkflows) return prev
      return [...prev, id]
    })
  }

  function handleConfirm() {
    if (selected.length === 0) return
    startTransition(async () => {
      try {
        await selectWorkflowsForOrg(selected)
        router.replace('/dashboard')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al seleccionar los flujos')
      }
    })
  }

  return (
    <div className="w-full max-w-screen-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Paso 4 · Flujos
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Elige tus flujos de trabajo</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Cada flujo es un tipo de proceso legal que tu organización podrá manejar. Podrás cambiarlos
          después en Configuración.
        </p>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <WorkflowIcon className="mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">No hay flujos disponibles aún.</p>
          <p className="mt-1 text-xs">El administrador del sistema configurará un flujo pronto.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {maxWorkflows === null
                ? `Tu plan ${planName} no limita el número de flujos.`
                : `Tu plan ${planName} incluye hasta ${maxWorkflows} ${maxWorkflows === 1 ? 'flujo' : 'flujos'}.`}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {maxWorkflows === null
                ? `${selected.length} ${selected.length === 1 ? 'seleccionado' : 'seleccionados'}`
                : `${selected.length} de ${maxWorkflows}`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {workflows.map((wf) => {
              const isSelected = selected.includes(wf.id)
              const isBlocked = !isSelected && limitReached
              const catalogLabels = wf.required_catalogs
                .filter(isProcessCatalogKey)
                .map((key) => ORG_CATALOGS[key].label)
              return (
                <button
                  key={wf.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isBlocked || isPending}
                  onClick={() => toggle(wf.id)}
                  className={cn(
                    'group w-full rounded-lg border p-4 text-left transition-all duration-150',
                    isSelected
                      ? 'border-foreground bg-foreground/[0.03]'
                      : 'border-border hover:border-foreground/30 hover:bg-muted/40',
                    isBlocked && 'cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                        {wf.icon_svg ? (
                          <span
                            className="flex h-4 w-4 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(wf.icon_svg) }}
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
                        {isSelected && catalogLabels.length > 0 && (
                          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            Usa {catalogLabels.join(', ')}: configúralo después en Configuración.
                          </p>
                        )}
                      </div>
                    </div>
                    <CheckCircle2
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 transition-opacity',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          {limitReached && (
            <p className="mt-3 text-xs text-muted-foreground">
              Alcanzaste el máximo de tu plan. Quita uno para elegir otro, o mejora tu plan más adelante en Plan y
              facturación.
            </p>
          )}
        </>
      )}

      <div className="sticky bottom-0 z-10 mt-8 flex justify-between bg-background/80 py-4 backdrop-blur-sm">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href="/onboarding/step3">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        {workflows.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={handleConfirm}
            disabled={selected.length === 0 || isPending}
          >
            {isPending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}
