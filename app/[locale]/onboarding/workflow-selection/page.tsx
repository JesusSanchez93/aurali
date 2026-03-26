import { getAvailableWorkflows } from './actions'
import { WorkflowSelectionForm } from './workflow-selection-form'

export default async function WorkflowSelectionPage() {
  const workflows = await getAvailableWorkflows()

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <WorkflowSelectionForm workflows={workflows} />
    </div>
  )
}
