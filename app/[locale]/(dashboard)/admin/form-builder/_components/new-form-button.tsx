'use client'

import { useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from '@/i18n/routing'
import { toast } from '@/lib/toast'
import { createNewForm } from '../[id]/actions'
import type { FormBuilderGroup } from '../actions'

interface Props {
  groups: FormBuilderGroup[]
}

/** Crea un formulario en blanco de inmediato (sin diálogo previo pidiendo
 *  nombre/tipo de flujo) y navega directo al builder — ahí, en la misma
 *  pantalla donde están las secciones, el super_admin edita el nombre y
 *  puede cambiar el tipo de flujo con el select correspondiente. Se asocia
 *  por defecto al primer tipo de flujo no-legado disponible; un mismo flujo
 *  puede tener varios formularios, así que no hay restricción de elegibilidad. */
export function NewFormButton({ groups }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const firstAvailable = groups.find((g) => !g.is_legacy_form)

  function handleClick() {
    if (!firstAvailable) {
      toast.error('Crea primero un tipo de flujo en "Flujos de trabajo".')
      return
    }

    startTransition(async () => {
      try {
        const { code } = await createNewForm(firstAvailable.workflow_template_id)
        router.push(`/admin/form-builder/${code}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al crear el formulario')
      }
    })
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
      Nuevo formulario
    </Button>
  )
}
