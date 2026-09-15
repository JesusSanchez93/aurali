/** Tipos de campo soportados por el dynamic form builder (formularios de cliente
 *  externo, uno por workflow_template / tipo de proceso legal). */
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'switch'
  | 'number'
  | 'phone'
  | 'date'
  | 'checkbox_group'
  | 'radio'
  | 'file_upload'
  | 'image_upload'
  | 'audio_transcription'
  | 'financial_product';

export type FinancialProductType = 'bank_account' | 'credit_card' | 'debit_card';

/** Un producto financiero afectado — mismo modelo usado hoy por el formulario
 *  legado de fraude bancario (legal_process_banks.products). El campo
 *  `financial_product` guarda un array de estos. */
export interface FinancialProductValue {
  type: FinancialProductType;
  last_4_digits: string;
  /** Requerido cuando type es credit_card/debit_card */
  card_brand?: string;
  /** Requerido cuando type es bank_account */
  account_type?: string;
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Regex source (sin flags), usado para construir z.string().regex() */
  pattern?: string;
  min?: number;
  max?: number;
}

/** Misma forma que DependsOnCondition (components/app/workflow-editor/node-config.ts)
 *  a propósito, para poder compartir la lógica de visibilidad (ver lib/forms/fieldVisibility.ts). */
export interface FormFieldDependsOn {
  key: string;
  value: boolean | string | string[];
}

/** Catálogos globales (administrados en Admin → Catálogo) que un campo
 *  select/radio/checkbox_group puede usar como origen de sus opciones, en vez
 *  de una lista escrita a mano. */
export type CatalogOptionsSource = 'catalog_banks' | 'catalog_documents';

export interface FormFieldSchema {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  helpText?: string;
  /** select, radio, checkbox_group */
  options?: FormFieldOption[];
  /** Si está presente, `options` se ignora y se resuelve en runtime desde el
   *  catálogo global correspondiente (lib/forms/catalogOptions.ts). */
  optionsSource?: CatalogOptionsSource;
  validation?: FormFieldValidation;
  /** Mostrar este campo solo si TODAS estas condiciones se cumplen (AND) */
  dependsOn?: FormFieldDependsOn[];
  /** Ancho declarado desde el builder. Mobile-first: en mobile todo campo ocupa
   *  100% sin importar este valor; el layout de 2 columnas solo aplica desde `sm:`.
   *  Default: 'full'. */
  width?: 'full' | 'half';
  /** file_upload / image_upload: mime types aceptados (ej. "image/*", ".pdf") */
  accept?: string;
  /** file_upload: máximo de archivos permitidos */
  maxFiles?: number;
}

export interface FormSection {
  /** Id interno estable, generado una vez al crear la sección — usado por el
   *  builder como identidad de React/dnd-kit/acordeón, independiente del slug
   *  editable `key`. Opcional para compatibilidad con schemas guardados antes
   *  de este campo (fallback a `key` en ese caso). */
  id?: string;
  /** Slug usado en la URL pública del cliente ([section]) */
  key: string;
  title: string;
  description?: string;
  order: number;
  fields: FormFieldSchema[];
}

export interface FormSchema {
  version: number;
  sections: FormSection[];
}
