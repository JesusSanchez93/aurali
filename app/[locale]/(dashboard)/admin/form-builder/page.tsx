import { requireSuperAdmin } from '@/lib/auth/permissions'
import { getFormBuilderGroups } from './actions'
import { NewFormButton } from './_components/new-form-button'
import { ImportFormButton } from './_components/import-form-dialog'
import { FormBuilderList } from './_components/form-builder-list'

export default async function AdminFormBuilderPage() {
  await requireSuperAdmin()

  const groups = await getFormBuilderGroups()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      {/* Si no caben lado a lado, las acciones bajan a su propia línea. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-semibold">Formularios</h1>
          <p className="text-sm text-muted-foreground">
            Formularios dinámicos que ven los clientes externos.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ImportFormButton />
          <NewFormButton groups={groups} />
        </div>
      </div>

      <FormBuilderList groups={groups} />
    </div>
  )
}
