'use client'

import { useRouter } from '@/i18n/routing'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { FormInput } from '@/components/common/form/form-input'
import { FormTextarea } from '@/components/common/form/form-textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { createGlobalWorkflow } from '../actions'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido').trim(),
  description: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewWorkflowPage() {
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  async function onSubmit(values: FormValues) {
    try {
      const { id } = await createGlobalWorkflow(values.name, values.description || undefined)
      toast.success('Flujo creado. Abre el editor para configurar los nodos.')
      router.push(`/admin/workflows/${id}/builder`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el flujo')
    }
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/admin/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Nuevo flujo global</h1>
          <p className="text-sm text-muted-foreground">
            Los flujos globales pueden ser seleccionados por cualquier organización.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormInput
            control={form.control}
            name="name"
            label="Nombre del flujo"
            placeholder="Ej: Proceso legal estándar"
            required
            disabled={isSubmitting}
          />
          <FormTextarea
            control={form.control}
            name="description"
            label="Descripción"
            placeholder="Describe el propósito de este flujo…"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear y abrir editor
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/workflows">Cancelar</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
