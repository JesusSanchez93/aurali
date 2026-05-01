'use client'

import { useRef, useState, useTransition } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  gradient_color: string | null
  gradient_color_to: string | null
  created_at: string
}

export function WorkflowCard({ wf }: { wf: WorkflowItem }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(wf.name)
  const [description, setDescription] = useState(wf.description ?? '')
  const [iconSvg, setIconSvg] = useState(wf.icon_svg ?? '')
  const [gradientColor, setGradientColor] = useState(wf.gradient_color ?? '#7c3aed')
  const [gradientColorTo, setGradientColorTo] = useState(wf.gradient_color_to ?? '#0ea5e9')
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
          gradient_color: gradientColor || null,
          gradient_color_to: gradientColorTo || null,
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
      <div className="group relative flex w-56 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">

        {/* Top half — icon zone */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${wf.gradient_color ?? '#7c3aed'}28 0%, ${wf.gradient_color_to ?? '#0ea5e9'}18 55%, ${wf.gradient_color_to ?? '#0ea5e9'}08 100%)`,
          }}
        >
          {/* Blurred blobs */}
          <div
            className="absolute -left-4 -top-4 h-24 w-24 rounded-full blur-2xl"
            style={{ background: `${wf.gradient_color ?? '#7c3aed'}50` }}
          />
          <div
            className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full blur-2xl"
            style={{ background: `${wf.gradient_color_to ?? '#0ea5e9'}40` }}
          />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-xl" />

          {/* Icon */}
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-sm ring-1 ring-white/20"
            style={{ color: wf.gradient_color ?? '#7c3aed' }}
          >
            {wf.icon_svg ? (
              <span
                className="flex h-8 w-8 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: wf.icon_svg }}
              />
            ) : (
              <Workflow className="h-8 w-8" />
            )}
          </div>

          {/* Action buttons — top-right */}
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg bg-background/60 p-0 text-muted-foreground backdrop-blur-sm hover:bg-background hover:text-foreground"
              onClick={() => setEditOpen(true)}
              disabled={isPending}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg bg-background/60 p-0 text-muted-foreground backdrop-blur-sm hover:bg-destructive/20 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Bottom half — content */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="flex flex-col gap-1.5">
            <p className="line-clamp-1 text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              {wf.name}
            </p>
            {wf.description ? (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {wf.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/40 italic">Sin descripción</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              {formatDistanceToNow(new Date(wf.created_at), { addSuffix: true, locale: es })}
            </p>
            <Button size="sm" className="h-8 w-full rounded-lg text-xs font-medium mt-4" asChild>
              <Link href={`/admin/workflows/${wf.id}/builder`}>
                <Workflow className="mr-1.5 h-3.5 w-3.5" />
                Abrir editor
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar flujo de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El flujo{' '}
              <span className="font-medium text-foreground">{wf.name}</span> será eliminado
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

            {/* Gradient colors */}
            <div className="space-y-2">
              <Label>Colores del degradado</Label>
              <div className="overflow-hidden rounded-lg border">
                {/* Preview */}
                <div
                  className="h-10 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${gradientColor} 0%, ${gradientColorTo} 100%)`,
                  }}
                />
                {/* Pickers */}
                <div className="flex divide-x">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50">
                    <input
                      type="color"
                      value={gradientColor}
                      onChange={(e) => setGradientColor(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Desde</p>
                      <p className="font-mono text-xs">{gradientColor}</p>
                    </div>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50">
                    <input
                      type="color"
                      value={gradientColorTo}
                      onChange={(e) => setGradientColorTo(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hasta</p>
                      <p className="font-mono text-xs">{gradientColorTo}</p>
                    </div>
                  </label>
                </div>
              </div>
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
