import { getAvailableWorkflows, getWorkflowSelectionLimit } from './actions'
import { WorkflowSelectionForm } from './workflow-selection-form'

export default async function WorkflowSelectionPage() {
  const [workflows, limit] = await Promise.all([getAvailableWorkflows(), getWorkflowSelectionLimit()])

  return <WorkflowSelectionForm workflows={workflows} planName={limit.planName} maxWorkflows={limit.maxWorkflows} />
}
