import { z } from 'zod';
import type { FormSchema } from './types';

/** Formato portable de un formulario del Dynamic Form Builder — pensado para
 *  moverse entre ambientes (dev → prod) o entre cuentas. Deliberadamente NO
 *  incluye `id`, `code`, `organization_id` ni `workflow_template_id`: ninguno
 *  de esos identificadores es portable entre ambientes/organizaciones, y el
 *  import siempre crea una fila nueva (mismo patrón que createNewForm/
 *  duplicateForm en admin/form-builder/[id]/actions.ts). */
export interface FormExportPayload {
  formatVersion: 1;
  name: string;
  schema: FormSchema;
  domainSyncKey: string | null;
  /** Solo informativo — ayuda a elegir el flujo destino al importar, no se usa para nada más. */
  sourceWorkflowTemplateName?: string;
  exportedAt: string;
}

export function buildFormExportPayload(row: {
  name: string;
  schema: FormSchema;
  domain_sync_key: string | null;
  workflowTemplateName?: string;
}): FormExportPayload {
  return {
    formatVersion: 1,
    name: row.name,
    schema: row.schema,
    domainSyncKey: row.domain_sync_key,
    sourceWorkflowTemplateName: row.workflowTemplateName,
    exportedAt: new Date().toISOString(),
  };
}

// Validación estructural liviana: no se valida cada tipo de campo en
// profundidad (el builder tampoco lo hace — el schema ya es JSONB libre),
// solo que el archivo tenga la forma mínima esperada.
const formFieldSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
  })
  .passthrough();

const formSectionSchema = z
  .object({
    key: z.string(),
    title: z.string(),
    order: z.number(),
    fields: z.array(formFieldSchema),
  })
  .passthrough();

export const formExportPayloadSchema = z
  .object({
    formatVersion: z.literal(1),
    name: z.string(),
    schema: z.object({
      version: z.number(),
      sections: z.array(formSectionSchema),
    }),
    domainSyncKey: z.string().nullable(),
    sourceWorkflowTemplateName: z.string().optional(),
    exportedAt: z.string(),
  })
  // La validación de arriba solo comprueba la forma mínima (ver comentario en
  // formFieldSchema/formSectionSchema); el tipo final se trata como
  // FormExportPayload para que el resto del código no lidie con los tipos
  // laxos que zod infiere de `.passthrough()`.
  .transform((data) => data as unknown as FormExportPayload);
