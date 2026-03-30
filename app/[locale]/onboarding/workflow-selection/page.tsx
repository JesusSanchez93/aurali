import { getAvailableWorkflows } from './actions'
import { WorkflowSelectionForm } from './workflow-selection-form'

export default async function WorkflowSelectionPage() {
  const workflows = await getAvailableWorkflows()

  return <WorkflowSelectionForm workflows={workflows} />
}
