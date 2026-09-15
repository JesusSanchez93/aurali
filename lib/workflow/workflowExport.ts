import { z } from 'zod'

/** Formato portable de un flujo de trabajo (workflow_template + nodos +
 *  conexiones) — pensado para moverse entre ambientes (dev → prod) o entre
 *  cuentas, igual que lib/forms/formExport.ts para formularios. `node_id` es
 *  el identificador estable de negocio de cada nodo (no la fila `id`, que no
 *  es portable) y las conexiones lo referencian por ese mismo valor — mismos
 *  campos que ya copia duplicateGlobalWorkflow al duplicar un flujo. */
export interface WorkflowNodeExport {
  node_id: string
  type: string
  title: string
  config: unknown
  position_x: number
  position_y: number
}

export interface WorkflowEdgeExport {
  source_node_id: string
  target_node_id: string
  source_handle_id: string | null
  target_handle_id: string | null
  condition: unknown
}

export interface WorkflowExportPayload {
  formatVersion: 1
  name: string
  description: string | null
  iconSvg: string | null
  gradientColor: string | null
  gradientColorTo: string | null
  isLegacyForm: boolean
  nodes: WorkflowNodeExport[]
  edges: WorkflowEdgeExport[]
  exportedAt: string
}

export function buildWorkflowExportPayload(
  template: {
    name: string
    description: string | null
    icon_svg: string | null
    gradient_color: string | null
    gradient_color_to: string | null
    is_legacy_form: boolean
  },
  nodes: WorkflowNodeExport[],
  edges: WorkflowEdgeExport[],
): WorkflowExportPayload {
  return {
    formatVersion: 1,
    name: template.name,
    description: template.description,
    iconSvg: template.icon_svg,
    gradientColor: template.gradient_color,
    gradientColorTo: template.gradient_color_to,
    isLegacyForm: template.is_legacy_form,
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  }
}

// Validación estructural liviana — no se valida el contenido de `config`/
// `condition` en profundidad (son JSONB libres, igual que en el resto del
// motor de workflows).
const workflowNodeSchema = z
  .object({
    node_id: z.string(),
    type: z.string(),
    title: z.string(),
    position_x: z.number(),
    position_y: z.number(),
  })
  .passthrough()

const workflowEdgeSchema = z
  .object({
    source_node_id: z.string(),
    target_node_id: z.string(),
  })
  .passthrough()

export const workflowExportPayloadSchema = z
  .object({
    formatVersion: z.literal(1),
    name: z.string(),
    description: z.string().nullable(),
    iconSvg: z.string().nullable(),
    gradientColor: z.string().nullable(),
    gradientColorTo: z.string().nullable(),
    isLegacyForm: z.boolean(),
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
    exportedAt: z.string(),
  })
  .transform((data) => data as unknown as WorkflowExportPayload)
