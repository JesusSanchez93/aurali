import type { WorkflowNodeType } from './types';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'richtext' | 'switch';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  /** Render this field only when another field (switch) has the given boolean value */
  dependsOn?: { key: string; value: boolean };
}

export interface NodeTypeConfig {
  label: string;
  description: string;
  /** Lucide icon name */
  icon: string;
  colorClass: string;
  borderClass: string;
  defaultTitle: string;
  defaultConfig: Record<string, unknown>;
  configSchema: ConfigField[];
  hasSourceHandle: boolean;
  hasTargetHandle: boolean;
}

/** Legal process status options — must match the CHECK constraint in the DB */
const STATUS_OPTIONS = [
  { value: 'draft',               label: 'Borrador' },
  { value: 'completed',           label: 'Completado' },
  { value: 'approved',            label: 'Aprobado' },
  { value: 'paid',                label: 'Pagado' },
  { value: 'documents_approved',  label: 'Documentos aprobados' },
  { value: 'documents_sent',      label: 'Documentos enviados' },
  { value: 'documents_received',  label: 'Documentos recibidos' },
  { value: 'finished',            label: 'Finalizado' },
];

export const NODE_TYPES_CONFIG: Record<WorkflowNodeType, NodeTypeConfig> = {

  // ── start ────────────────────────────────────────────────────────────────
  start: {
    label:        'Inicio',
    description:  'Punto de inicio del flujo',
    icon:         'Play',
    colorClass:   'bg-emerald-500',
    borderClass:  'border-emerald-500',
    defaultTitle: 'Inicio',
    defaultConfig: {},
    configSchema:  [],
    hasSourceHandle: true,
    hasTargetHandle: false,
  },

  // ── send_email ───────────────────────────────────────────────────────────
  send_email: {
    label:        'Enviar Correo',
    description:  'Envía un correo electrónico al cliente o al abogado',
    icon:         'Mail',
    colorClass:   'bg-blue-500',
    borderClass:  'border-blue-500',
    defaultTitle: 'Enviar Correo',
    defaultConfig: { to: '', subject: '', body: '', attach_enabled: false },
    configSchema: [
      { key: 'to',      label: 'Para',    type: 'text',     placeholder: '{PROCESS.EMAIL}', required: true },
      { key: 'subject', label: 'Asunto',  type: 'text',     placeholder: 'Asunto del correo', required: true },
      { key: 'body',    label: 'Cuerpo',  type: 'richtext' },
      { key: 'attach_enabled', label: 'Adjuntar documentos PDF generados', type: 'switch' },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── client_form ──────────────────────────────────────────────────────────
  client_form: {
    label:        'Formulario del Cliente',
    description:  'Pausa el flujo hasta que el cliente envíe el formulario público',
    icon:         'FileText',
    colorClass:   'bg-violet-500',
    borderClass:  'border-violet-500',
    defaultTitle: 'Formulario del Cliente',
    defaultConfig: { title: '', description: '' },
    configSchema: [
      { key: 'title',       label: 'Título',       type: 'text',     placeholder: 'Información personal', required: true },
      { key: 'description', label: 'Descripción',  type: 'textarea', placeholder: 'Ingrese sus datos...' },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── notify_lawyer ────────────────────────────────────────────────────────
  notify_lawyer: {
    label:        'Notificar Abogado',
    description:  'Crea una notificación interna y envía un correo al abogado asignado',
    icon:         'Bell',
    colorClass:   'bg-cyan-500',
    borderClass:  'border-cyan-500',
    defaultTitle: 'Notificar Abogado',
    defaultConfig: { message: '', recipients: 'lawyer' },
    configSchema: [
      { key: 'message',    label: 'Mensaje',       type: 'textarea', placeholder: 'Mensaje de notificación...', required: true },
      {
        key: 'recipients', label: 'Destinatarios', type: 'select',   required: true,
        options: [
          { value: 'lawyer', label: 'Abogado' },
          { value: 'client', label: 'Cliente' },
          { value: 'all',    label: 'Todos' },
        ],
      },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── manual_action ────────────────────────────────────────────────────────
  manual_action: {
    label:        'Acción Manual',
    description:  'Pausa el flujo hasta que el abogado complete una tarea manual',
    icon:         'ClipboardList',
    colorClass:   'bg-rose-500',
    borderClass:  'border-rose-500',
    defaultTitle: 'Acción Manual',
    defaultConfig: { instructions: '', assignee: 'lawyer' },
    configSchema: [
      { key: 'instructions', label: 'Instrucciones', type: 'textarea', placeholder: 'Descripción de la tarea...', required: true },
      {
        key: 'assignee', label: 'Asignado a', type: 'select', required: true,
        options: [
          { value: 'lawyer',    label: 'Abogado' },
          { value: 'assistant', label: 'Asistente' },
        ],
      },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── generate_document ────────────────────────────────────────────────────
  generate_document: {
    label:        'Generar Documento',
    description:  'El abogado selecciona las plantillas al ejecutar el paso',
    icon:         'FilePlus',
    colorClass:   'bg-orange-500',
    borderClass:  'border-orange-500',
    defaultTitle: 'Generar Documento',
    defaultConfig: { preview: false },
    configSchema: [
      { key: 'preview', label: 'Modo vista previa (el admin revisa antes de generar los PDFs)', type: 'switch' },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── send_documents ───────────────────────────────────────────────────────
  send_documents: {
    label:        'Enviar Documentos',
    description:  'Envía por correo el enlace del documento generado al cliente',
    icon:         'Send',
    colorClass:   'bg-indigo-500',
    borderClass:  'border-indigo-500',
    defaultTitle: 'Enviar Documentos',
    defaultConfig: {
      to:      '{PROCESS.EMAIL}',
      subject: 'Sus documentos legales están listos',
      body:    'Sus documentos están disponibles en: {OUTPUT.DOCUMENT_URL}',
    },
    configSchema: [
      { key: 'to',      label: 'Para',    type: 'text',     placeholder: '{PROCESS.EMAIL}',           required: true },
      { key: 'subject', label: 'Asunto',  type: 'text',     placeholder: 'Sus documentos están listos', required: true },
      { key: 'body',    label: 'Cuerpo',  type: 'richtext' },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── status_update ────────────────────────────────────────────────────────
  status_update: {
    label:        'Actualizar Estado',
    description:  'Cambia el estado del proceso legal',
    icon:         'RefreshCw',
    colorClass:   'bg-amber-500',
    borderClass:  'border-amber-500',
    defaultTitle: 'Actualizar Estado',
    defaultConfig: { new_status: 'draft' },
    configSchema: [
      {
        key: 'new_status', label: 'Nuevo Estado', type: 'select', required: true,
        options: STATUS_OPTIONS,
      },
    ],
    hasSourceHandle: true,
    hasTargetHandle: true,
  },

  // ── end ──────────────────────────────────────────────────────────────────
  end: {
    label:        'Fin',
    description:  'Punto final del flujo',
    icon:         'CircleStop',
    colorClass:   'bg-slate-500',
    borderClass:  'border-slate-500',
    defaultTitle: 'Fin',
    defaultConfig: {},
    configSchema:  [],
    hasSourceHandle: false,
    hasTargetHandle: true,
  },
};
