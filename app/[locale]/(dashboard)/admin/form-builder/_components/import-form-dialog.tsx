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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { formExportPayloadSchema, type FormExportPayload } from '@/lib/forms/formExport'
import { getAvailableWorkflowTemplates, type WorkflowTemplateOption } from '../[id]/actions'
import { importForm } from '../actions'

/** Botón + diálogo para importar un formulario exportado (ver "Exportar" en
 *  cada fila de la lista) — crea un formulario NUEVO e independiente,
 *  asociado al workflow_template elegido aquí. Pensado para mover
 *  formularios de un ambiente a otro (dev → prod) o entre cuentas: el
 *  archivo nunca trae identificadores del ambiente de origen (ver
 *  lib/forms/formExport.ts). */
export function ImportFormButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<WorkflowTemplateOption[]>([])
  const [workflowTemplateId, setWorkflowTemplateId] = useState<string>('')
  const [payload, setPayload] = useState<FormExportPayload | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  function resetState() {
    setPayload(null)
    setFileError(null)
    setWorkflowTemplateId('')
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      resetState()
      return
    }

    setIsLoadingTemplates(true)
    getAvailableWorkflowTemplates()
      .then(setTemplates)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al cargar los tipos de flujo'))
      .finally(() => setIsLoadingTemplates(false))
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
      const parsed = formExportPayloadSchema.safeParse(json)
      if (!parsed.success) {
        setFileError('El archivo no corresponde a un formulario exportado válido.')
        return
      }
      setPayload(parsed.data)
    } catch {
      setFileError('Archivo inválido o corrupto — asegúrate de subir un .json exportado desde esta pantalla.')
    }
  }

  function handleImport() {
    if (!payload || !workflowTemplateId) return

    setIsImporting(true)
    importForm(workflowTemplateId, payload)
      .then(({ code }) => {
        toast.success('Formulario importado como borrador')
        handleOpenChange(false)
        router.push(`/admin/form-builder/${code}`)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Error al importar el formulario'))
      .finally(() => setIsImporting(false))
  }

  return (
    <>
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <Upload className="mr-1.5 h-4 w-4" />
        Importar formulario
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Importar formulario</DialogTitle>
            <DialogDescription>
              Sube un archivo .json exportado desde otro ambiente o cuenta. Se creará como un formulario nuevo, en
              borrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="import-form-file">Archivo</Label>
              <input
                id="import-form-file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              {payload && !fileError && (
                <p className="text-xs text-muted-foreground">
                  Listo: &quot;{payload.name}&quot; ({payload.schema.sections.length} sección
                  {payload.schema.sections.length === 1 ? '' : 'es'})
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de flujo destino</Label>
              <Select value={workflowTemplateId} onValueChange={setWorkflowTemplateId} disabled={isLoadingTemplates}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTemplates ? 'Cargando...' : 'Selecciona un flujo'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!payload || !workflowTemplateId || isImporting}>
              {isImporting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
