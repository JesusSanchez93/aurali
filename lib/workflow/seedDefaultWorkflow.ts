/**
 * seedDefaultWorkflow.ts
 *
 * Inserts the "Proceso Legal General" workflow template for a specific
 * organization. Safe to call multiple times — skips if already present.
 *
 * FLOW (19 nodes, 18 edges — linear):
 *
 *   start
 *   → status_update        (draft)
 *   → send_email           (Enviar formulario al cliente)
 *   → client_form          ← BLOCKING: cliente llena el formulario
 *   → status_update        (completed)
 *   → notify_lawyer        (Notificar al abogado)
 *   → manual_action        ← BLOCKING: abogado valida los datos del cliente
 *   → status_update        (approved)
 *   → generate_document    (Generar borradores)
 *   → manual_action        ← BLOCKING: abogado revisa y aprueba borradores
 *   → generate_document    (Generar documentos finales)
 *   → send_email           (Enviar documentos al cliente)
 *   → status_update        (documents_sent)
 *   → manual_action        ← BLOCKING: abogado registra documentos recibidos firmados
 *   → status_update        (documents_received)
 *   → manual_action        ← BLOCKING: abogado marca el pago
 *   → status_update        (paid)
 *   → status_update        (finished)
 *   → end
 */

import { createClient } from '@/lib/supabase/server';

// ─── Node definitions ──────────────────────────────────────────────────────────

const NODES = [
  {
    node_id:    'node-start',
    type:       'start',
    title:      'Inicio',
    config:     {},
    position_x: 400,
    position_y: 40,
  },
  {
    node_id:    'node-status-draft',
    type:       'status_update',
    title:      'Crear proceso',
    config:     { new_status: 'draft' },
    position_x: 400,
    position_y: 160,
  },
  {
    node_id:    'node-send-form-email',
    type:       'send_email',
    title:      'Enviar formulario al cliente',
    config: {
      to:      '{{process.email}}',
      subject: 'Complete su información — proceso {{process.id}}',
      body:    'Estimado/a {{client.first_name}},\n\nHemos iniciado su proceso legal. Por favor complete el formulario de información personal en el siguiente enlace:\n\n{{form_url}}\n\nEste enlace es válido por 72 horas.\n\nQuedamos a su disposición.',
    },
    position_x: 400,
    position_y: 280,
  },
  {
    node_id:    'node-client-form',
    type:       'client_form',
    title:      'Datos del cliente',
    config: {
      title:       'Información personal',
      description: 'Por favor complete sus datos personales para continuar con el proceso.',
      fields: [
        { name: 'first_name',      label: 'Nombres',            type: 'text',   required: true },
        { name: 'last_name',       label: 'Apellidos',          type: 'text',   required: true },
        { name: 'document_type',   label: 'Tipo de documento',  type: 'select', required: true,
          options: ['CC', 'CE', 'NIT', 'PP', 'TE'] },
        { name: 'document_number', label: 'Número de documento', type: 'text',  required: true },
        { name: 'address',         label: 'Dirección',          type: 'text',   required: false },
        { name: 'city',            label: 'Ciudad',             type: 'text',   required: false },
        { name: 'phone',           label: 'Teléfono',           type: 'text',   required: true },
        { name: 'email',           label: 'Correo electrónico', type: 'email',  required: true },
      ],
    },
    position_x: 400,
    position_y: 400,
  },
  {
    node_id:    'node-status-completed',
    type:       'status_update',
    title:      'Datos recibidos',
    config:     { new_status: 'completed' },
    position_x: 400,
    position_y: 520,
  },
  {
    node_id:    'node-notify-lawyer',
    type:       'notify_lawyer',
    title:      'Notificar al abogado',
    config: {
      message:    'El cliente {{client.first_name}} {{client.last_name}} completó el formulario del proceso {{process.id}}.\n\nPor favor revise los datos y apruebe para continuar.',
      recipients: 'lawyer',
    },
    position_x: 400,
    position_y: 640,
  },
  {
    node_id:    'node-manual-review-data',
    type:       'manual_action',
    title:      'Revisión de datos del cliente',
    config: {
      instructions: '1. Verificar la identidad del cliente con el documento provisto.\n2. Confirmar datos de contacto (teléfono, correo, dirección).\n3. Aprobar para proceder con la generación de documentos.',
      assignee:     'lawyer',
    },
    position_x: 400,
    position_y: 760,
  },
  {
    node_id:    'node-status-approved',
    type:       'status_update',
    title:      'Datos aprobados',
    config:     { new_status: 'approved' },
    position_x: 400,
    position_y: 880,
  },
  {
    node_id:    'node-generate-doc-draft',
    type:       'generate_document',
    title:      'Generar borradores',
    config: {
      template_ids: [],   // Must be set to real document_templates UUIDs
    },
    position_x: 400,
    position_y: 1000,
  },
  {
    node_id:    'node-manual-review-docs',
    type:       'manual_action',
    title:      'Revisión de documentos borrador',
    config: {
      instructions: '1. Revisar el contenido de los documentos borrador generados.\n2. Verificar que los datos del cliente sean correctos.\n3. Aprobar para generar los documentos finales y enviarlos al cliente.',
      assignee:     'lawyer',
    },
    position_x: 400,
    position_y: 1120,
  },
  {
    node_id:    'node-generate-doc-final',
    type:       'generate_document',
    title:      'Generar documentos finales',
    config: {
      template_ids: [],   // Must be set to real document_templates UUIDs
    },
    position_x: 400,
    position_y: 1240,
  },
  {
    node_id:    'node-send-documents',
    type:       'send_email',
    title:      'Enviar documentos al cliente',
    config: {
      to:               '{{process.email}}',
      subject:          'Sus documentos legales están listos',
      body:             'Estimado/a {{client.first_name}},\n\nSus documentos legales han sido preparados y se adjuntan a este correo.\n\nGracias por confiar en nuestros servicios.',
      attach_documents: 'all',
    },
    position_x: 400,
    position_y: 1360,
  },
  {
    node_id:    'node-status-docs-sent',
    type:       'status_update',
    title:      'Documentos enviados',
    config:     { new_status: 'documents_sent' },
    position_x: 400,
    position_y: 1480,
  },
  {
    node_id:    'node-manual-docs-received',
    type:       'manual_action',
    title:      'Registrar documentos recibidos',
    config: {
      instructions: '1. Verificar que el cliente haya devuelto los documentos firmados y autenticados.\n2. Archivar los documentos recibidos.\n3. Confirmar para continuar con el proceso.',
      assignee:     'lawyer',
    },
    position_x: 400,
    position_y: 1600,
  },
  {
    node_id:    'node-status-docs-received',
    type:       'status_update',
    title:      'Documentos recibidos',
    config:     { new_status: 'documents_received' },
    position_x: 400,
    position_y: 1720,
  },
  {
    node_id:    'node-manual-payment',
    type:       'manual_action',
    title:      'Confirmar pago',
    config: {
      instructions: '1. Verificar que el cliente haya realizado el pago correspondiente.\n2. Registrar el comprobante de pago.\n3. Confirmar para finalizar el proceso.',
      assignee:     'lawyer',
    },
    position_x: 400,
    position_y: 1840,
  },
  {
    node_id:    'node-status-paid',
    type:       'status_update',
    title:      'Pago registrado',
    config:     { new_status: 'paid' },
    position_x: 400,
    position_y: 1960,
  },
  {
    node_id:    'node-status-finished',
    type:       'status_update',
    title:      'Proceso finalizado',
    config:     { new_status: 'finished' },
    position_x: 400,
    position_y: 2080,
  },
  {
    node_id:    'node-end',
    type:       'end',
    title:      'Fin',
    config:     {},
    position_x: 400,
    position_y: 2200,
  },
] as const;

// ─── Edge definitions (linear, no conditions) ──────────────────────────────────

const EDGES = [
  { source_node_id: 'node-start',               target_node_id: 'node-status-draft' },
  { source_node_id: 'node-status-draft',         target_node_id: 'node-send-form-email' },
  { source_node_id: 'node-send-form-email',      target_node_id: 'node-client-form' },
  { source_node_id: 'node-client-form',          target_node_id: 'node-status-completed' },
  { source_node_id: 'node-status-completed',     target_node_id: 'node-notify-lawyer' },
  { source_node_id: 'node-notify-lawyer',        target_node_id: 'node-manual-review-data' },
  { source_node_id: 'node-manual-review-data',   target_node_id: 'node-status-approved' },
  { source_node_id: 'node-status-approved',      target_node_id: 'node-generate-doc-draft' },
  { source_node_id: 'node-generate-doc-draft',   target_node_id: 'node-manual-review-docs' },
  { source_node_id: 'node-manual-review-docs',   target_node_id: 'node-generate-doc-final' },
  { source_node_id: 'node-generate-doc-final',   target_node_id: 'node-send-documents' },
  { source_node_id: 'node-send-documents',       target_node_id: 'node-status-docs-sent' },
  { source_node_id: 'node-status-docs-sent',     target_node_id: 'node-manual-docs-received' },
  { source_node_id: 'node-manual-docs-received', target_node_id: 'node-status-docs-received' },
  { source_node_id: 'node-status-docs-received', target_node_id: 'node-manual-payment' },
  { source_node_id: 'node-manual-payment',       target_node_id: 'node-status-paid' },
  { source_node_id: 'node-status-paid',          target_node_id: 'node-status-finished' },
  { source_node_id: 'node-status-finished',      target_node_id: 'node-end' },
] as const;

// ─── Public function ───────────────────────────────────────────────────────────

/**
 * Seeds the "Proceso Legal General" workflow template for `organizationId`.
 * Returns the template UUID (existing or newly created).
 */
export async function seedDefaultWorkflow(organizationId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  // ── Guard ─────────────────────────────────────────────────────────────────
  const { data: existing } = await db
    .from('workflow_templates')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', 'Proceso Legal General')
    .maybeSingle() as { data: { id: string } | null };

  if (existing) return existing.id;

  // ── Template ──────────────────────────────────────────────────────────────
  const { data: template, error: tplErr } = await db
    .from('workflow_templates')
    .insert({
      organization_id: organizationId,
      name:            'Proceso Legal General',
      description:     'Flujo estándar: captación, recopilación de datos, revisión del abogado, generación y envío de documentos, recepción de documentos firmados y confirmación de pago.',
      is_default:      true,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (tplErr || !template) {
    throw new Error(`Error al crear workflow template: ${tplErr?.message ?? 'desconocido'}`);
  }

  const templateId = template.id;

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const { error: nodesErr } = await db
    .from('workflow_nodes')
    .insert(NODES.map((n) => ({ ...n, template_id: templateId })));

  if (nodesErr) {
    throw new Error(`Error al insertar nodos: ${nodesErr.message}`);
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  const { error: edgesErr } = await db
    .from('workflow_edges')
    .insert(EDGES.map((e) => ({ ...e, template_id: templateId, condition: null })));

  if (edgesErr) {
    throw new Error(`Error al insertar aristas: ${edgesErr.message}`);
  }

  return templateId;
}
