import type { FormFieldType } from './types';

export interface FormFieldTypeConfig {
  label: string;
  /** Lucide icon name */
  icon: string;
  description: string;
}

/** Metadata por tipo de campo para el selector "agregar campo" del form builder.
 *  Objeto propio (no compartido con NODE_TYPES_CONFIG de node-config.ts), ya que
 *  describe campos de formulario de cliente, no nodos de workflow. */
export const FORM_FIELD_TYPES_CONFIG: Record<FormFieldType, FormFieldTypeConfig> = {
  text: {
    label: 'Texto corto',
    icon: 'TextCursorInput',
    description: 'Una línea de texto libre (nombre, número de documento, etc.)',
  },
  textarea: {
    label: 'Texto largo',
    icon: 'AlignLeft',
    description: 'Texto de varias líneas (descripción, relato de un evento)',
  },
  select: {
    label: 'Lista desplegable',
    icon: 'ChevronDownSquare',
    description: 'El cliente elige una opción de una lista',
  },
  switch: {
    label: 'Sí / No',
    icon: 'ToggleLeft',
    description: 'Un interruptor booleano (aceptación, confirmación)',
  },
  number: {
    label: 'Número',
    icon: 'Hash',
    description: 'Un valor numérico, con mínimo/máximo opcional',
  },
  phone: {
    label: 'Teléfono',
    icon: 'Phone',
    description: 'Número de teléfono con formato validado',
  },
  date: {
    label: 'Fecha',
    icon: 'CalendarDays',
    description: 'Selección de una fecha',
  },
  checkbox_group: {
    label: 'Selección múltiple',
    icon: 'ListChecks',
    description: 'El cliente puede marcar varias opciones a la vez',
  },
  radio: {
    label: 'Opción única',
    icon: 'CircleDot',
    description: 'El cliente elige una única opción entre varias visibles',
  },
  file_upload: {
    label: 'Archivo',
    icon: 'Paperclip',
    description: 'Carga de uno o más archivos de soporte',
  },
  image_upload: {
    label: 'Imagen',
    icon: 'ImagePlus',
    description: 'Carga de una imagen (ej. documento de identidad)',
  },
  audio_transcription: {
    label: 'Audio con transcripción',
    icon: 'Mic',
    description: 'El cliente graba un audio que se transcribe automáticamente a texto',
  },
  financial_product: {
    label: 'Producto financiero',
    icon: 'CreditCard',
    description: 'Lista repetible de cuentas/tarjetas afectadas, con tipo, marca y últimos 4 dígitos',
  },
};
