'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { workflowExportPayloadSchema, type WorkflowExportPayload } from '@/lib/workflow/workflowExport'
import { importWorkflow } from '../actions'

/** Botón + diálogo para importar un flujo exportado (ver "Exportar" en cada
 *  tarjeta de flujo) — crea un flujo global NUEVO e independiente. Pensado
 *  para mover flujos de un ambiente a otro (dev → prod) o entre cuentas: el
 *  archivo nunca trae identificadores del ambiente de origen (ver
 *  lib/workflow/workflowExport.ts). */
export function ImportWorkflowButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [payload, setPayload] = useState<WorkflowExportPayload | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  function resetState() {
    setPayload(null)
    setFileError(null)
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) resetState()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setFileError(null)
    setPayload(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const parsed = workflowExportPayloadSchema.safeParse(json)
      if (!parsed.success) {
        setFileError('El archivo no corresponde a un flujo exportado válido.')
        return
      }
      setPayload(parsed.data)
    } catch {
      setFileError('Archivo inválido o corrupto — asegúrate de subir un .json exportado desde esta pantalla.')
    }
  }

  function handleImport() {
    if (!payload) return

    setIsImporting(true)
    importWorkflow(payload)
      .then(({ id }) => {
        toast.success('Flujo importado')
        handleOpenChange(false)
        router.push(`/admin/workflows/${id}/builder`)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al importar el flujo'))
      .finally(() => setIsImporting(false))
  }

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <Upload className="mr-2 h-4 w-4" />
        Importar flujo
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Importar flujo de trabajo</DialogTitle>
            <DialogDescription>
              Sube un archivo .json exportado desde otro ambiente o cuenta. Se creará como un flujo global nuevo, con
              sus nodos y conexiones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="import-workflow-file">Archivo</Label>
            <input
              id="import-workflow-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            {payload && !fileError && (
              <p className="text-xs text-muted-foreground">
                Listo: &quot;{payload.name}&quot; ({payload.nodes.length} nodo{payload.nodes.length === 1 ? '' : 's'},{' '}
                {payload.edges.length} conexión{payload.edges.length === 1 ? '' : 'es'})
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!payload || isImporting}>
              {isImporting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
