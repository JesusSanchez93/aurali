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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Formularios</h1>
          <p className="text-sm text-muted-foreground">
            Formularios dinámicos que ven los clientes externos.
          </p>
        </div>
        <div className="flex gap-2">
          <ImportFormButton />
          <NewFormButton groups={groups} />
        </div>
      </div>

      <FormBuilderList groups={groups} />
    </div>
  )
}
