'use client'

import { useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Link } from '@/i18n/routing'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Pencil, Trash2, Upload, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { deleteGlobalWorkflow, updateGlobalWorkflow } from '../actions'

export type WorkflowItem = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  icon_svg: string | null
  created_at: string
}

export function WorkflowCard({ wf }: { wf: WorkflowItem }) {
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState(wf.name)
  const [description, setDescription] = useState(wf.description ?? '')
  const [iconSvg, setIconSvg] = useState(wf.icon_svg ?? '')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setIconSvg(ev.target?.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateGlobalWorkflow(wf.id, {
          name: name.trim(),
          description: description.trim() || null,
          icon_svg: iconSvg.trim() || null,
        })
        toast.success('Flujo actualizado')
        setEditOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al actualizar')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteGlobalWorkflow(wf.id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      }
    })
  }

  return (
    <>
      <Card className="group flex flex-col">
        <CardHeader className="flex-1 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                {wf.icon_svg ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: wf.icon_svg }}
                  />
                ) : (
                  <Workflow className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-base">{wf.name}</CardTitle>
                {wf.description && (
                  <CardDescription className="mt-1 line-clamp-2 text-xs">
                    {wf.description}
                  </CardDescription>
                )}
              </div>
            </div>
            {wf.is_default && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Por defecto
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Creado{' '}
            {formatDistanceToNow(new Date(wf.created_at), { addSuffix: true, locale: es })}
          </p>
        </CardHeader>

        <CardContent className="flex gap-2 pt-0">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/admin/workflows/${wf.id}/builder`}>
              <Workflow className="mr-2 h-3.5 w-3.5" />
              Abrir editor
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => setEditOpen(true)}
            disabled={isPending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar flujo de trabajo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del flujo"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="wf-desc">Descripción</Label>
              <Textarea
                id="wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el propósito de este flujo…"
                rows={3}
              />
            </div>

            {/* SVG icon */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Icono SVG</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3 w-3" />
                  Cargar .svg
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={handleFile}
              />
              <Textarea
                value={iconSvg}
                onChange={(e) => setIconSvg(e.target.value)}
                placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ...>...</svg>"
                rows={5}
                className="font-mono text-xs"
              />
              {iconSvg.trim() && (
                <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
                  <span className="text-xs text-muted-foreground">Vista previa:</span>
                  <span
                    className="flex h-8 w-8 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: iconSvg }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isPending || !name.trim()}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
