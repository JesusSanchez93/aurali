'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Check, Copy, Download, FileText, MoreVertical, Pencil, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Link, useRouter } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { deleteForm, duplicateForm } from '../[id]/actions'
import { exportForm, type FormBuilderGroup } from '../actions'

interface Props {
  groups: FormBuilderGroup[]
}

type Stage = 'idle' | 'actions' | 'confirm-delete' | 'confirm-duplicate'

const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
  center: {
    x: 0,
    opacity: 1,
    pointerEvents: 'auto',
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    pointerEvents: 'none',
    transition: { duration: 0.14, ease: 'easeIn' },
  }),
}

/** Cada botón del panel de acciones hereda el estado de `stageVariants` del
 *  padre (mismos nombres de variant) — el `staggerChildren` de arriba hace
 *  que entren uno por uno en vez de todos a la vez. */
const actionItemVariants: Variants = {
  enter: { opacity: 0, x: 6 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 6 },
}

export function FormBuilderList({ groups }: Props) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [direction, setDirection] = useState<1 | -1>(1)

  // Una sola lista plana de formularios — el tipo de flujo al que pertenece
  // cada uno se muestra como info secundaria dentro del propio ítem, no como
  // encabezado de grupo.
  const forms = groups.flatMap((group) =>
    group.forms.map((form) => ({ ...form, workflow_template_name: group.workflow_template_name })),
  )

  useEffect(() => {
    if (!activeId) return
    const handler = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest(`[data-form-row="${activeId}"]`)
      if (!row) {
        setActiveId(null)
        setStage('idle')
        setDirection(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeId])

  useEffect(() => {
    if (!activeId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (stage === 'confirm-delete' || stage === 'confirm-duplicate') {
        setStage('actions')
        setDirection(-1)
      } else {
        setActiveId(null)
        setStage('idle')
        setDirection(-1)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeId, stage])

  const openActions = (id: string) => {
    setActiveId(id)
    setStage('actions')
    setDirection(1)
  }

  const goConfirmDelete = () => {
    setStage('confirm-delete')
    setDirection(1)
  }

  const goConfirmDuplicate = () => {
    setStage('confirm-duplicate')
    setDirection(1)
  }

  const goBackToActions = () => {
    setStage('actions')
    setDirection(-1)
  }

  function handleConfirmDuplicate(code: string) {
    setPendingId(code)
    duplicateForm(code)
      .then(({ code: newCode }) => {
        toast.success('Formulario duplicado')
        router.push(`/admin/form-builder/${newCode}`)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al duplicar el formulario'))
      .finally(() => {
        setPendingId(null)
        setActiveId(null)
        setStage('idle')
      })
  }

  function handleExport(code: string, formName: string) {
    setPendingId(code)
    exportForm(code)
      .then((payload) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `formulario-${code}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`"${formName}" exportado`)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al exportar el formulario'))
      .finally(() => setPendingId(null))
  }

  function handleConfirmDelete(code: string) {
    setPendingId(code)
    deleteForm(code)
      .then(() => {
        toast.success('Formulario eliminado')
        router.refresh()
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al eliminar el formulario'))
      .finally(() => {
        setPendingId(null)
        setActiveId(null)
        setStage('idle')
      })
  }

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center text-muted-foreground">
        <FileText className="mb-4 h-10 w-10 opacity-30" />
        <p className="text-sm">No hay formularios creados todavía.</p>
        <p className="mt-1 text-xs">Usa &quot;Nuevo formulario&quot; para crear el primero.</p>
      </div>
    )
  }

  return (
    <div className="divide-y rounded-lg border">
      {forms.map((form) => {
        const rowStage: Stage = activeId === form.schema_id ? stage : 'idle'

        return (
          <div
            key={form.schema_id}
            data-form-row={form.schema_id}
            className="relative flex items-center justify-between gap-4 overflow-hidden px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {form.form_name}
                </p>
                {form.is_published ? (
                  <Badge className="shrink-0 text-[10px]">Publicado</Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-[10px]">Borrador</Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">Tipo de proceso: {form.workflow_template_name}</p>
              <p className="truncate text-xs font-mono text-muted-foreground">{`{FORM_URL:${form.code}}`}</p>
            </div>

            {/* Ancla en flujo normal — se desliza a la derecha y se
                desvanece mientras el panel flotante está abierto, y vuelve
                a su lugar al cerrarlo. El contenido de la izquierda nunca
                se mueve. */}
            <motion.div
              className="shrink-0"
              animate={{ x: rowStage === 'idle' ? 0 : -12, opacity: rowStage === 'idle' ? 1 : 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              <Button
                variant="ghost"
                size="icon"
                disabled={pendingId === form.code || rowStage !== 'idle'}
                onClick={() => openActions(form.schema_id)}
                title="Acciones"
              >
                {pendingId === form.code ? <Spinner className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </motion.div>

            {/* Panel flotante de acciones — absolute, no reserva espacio ni
                empuja el contenido; blurea lo que tiene detrás para que no
                se pierda con el texto de la card. */}
            <AnimatePresence initial={false} custom={direction}>
              {rowStage !== 'idle' && (
                <motion.div
                  key={rowStage}
                  custom={direction}
                  variants={stageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className={cn(
                    'absolute inset-y-0 right-0 z-10 flex items-center gap-1 rounded-l-lg bg-background/80 pl-8 pr-3 backdrop-blur-sm',
                    rowStage === 'confirm-delete' && 'bg-destructive/10',
                    rowStage === 'confirm-duplicate' && 'bg-primary/10',
                  )}
                >
                  {rowStage === 'actions' && (
                    <>
                      <motion.div variants={actionItemVariants}>
                        <Button variant="ghost" size="icon" asChild title="Editar">
                          <Link href={`/admin/form-builder/${form.code}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </motion.div>
                      <motion.div variants={actionItemVariants}>
                        <Button variant="ghost" size="icon" onClick={goConfirmDuplicate} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div variants={actionItemVariants}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendingId === form.code}
                          onClick={() => handleExport(form.code, form.form_name)}
                          title="Exportar"
                        >
                          {pendingId === form.code ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </motion.div>
                      <motion.div variants={actionItemVariants}>
                        <Button variant="ghost" size="icon" onClick={goConfirmDelete} title="Eliminar">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </motion.div>
                    </>
                  )}

                  {rowStage === 'confirm-duplicate' && (
                    <>
                      <motion.div variants={actionItemVariants}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendingId === form.code}
                          onClick={() => handleConfirmDuplicate(form.code)}
                          title="Confirmar"
                        >
                          {pendingId === form.code ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4 text-primary" />}
                        </Button>
                      </motion.div>
                      <motion.div variants={actionItemVariants}>
                        <Button variant="ghost" size="icon" onClick={goBackToActions} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </>
                  )}

                  {rowStage === 'confirm-delete' && (
                    <>
                      <motion.div variants={actionItemVariants}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendingId === form.code}
                          onClick={() => handleConfirmDelete(form.code)}
                          title="Confirmar"
                        >
                          {pendingId === form.code ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4 text-destructive" />}
                        </Button>
                      </motion.div>
                      <motion.div variants={actionItemVariants}>
                        <Button variant="ghost" size="icon" onClick={goBackToActions} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
