import type { FormFieldSchema } from './types';

/** Serializa los valores de una sección (estado de react-hook-form) a FormData,
 *  para poder enviar archivos junto con el resto de campos a una server action. */
export function encodeSectionFormData(fields: FormFieldSchema[], values: Record<string, unknown>): FormData {
  const formData = new FormData();

  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || value === null) continue;

    if (field.type === 'file_upload' || field.type === 'image_upload') {
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item instanceof File) formData.append(field.key, item);
        else if (typeof item === 'string' && item) formData.append(`${field.key}__existing`, item);
      }
      continue;
    }

    if (field.type === 'checkbox_group') {
      for (const item of Array.isArray(value) ? value : []) formData.append(field.key, String(item));
      continue;
    }

    if (field.type === 'financial_product') {
      formData.append(field.key, JSON.stringify(value));
      continue;
    }

    formData.append(field.key, String(value));
  }

  return formData;
}

export interface DecodedFileValue {
  /** Archivos nuevos seleccionados por el cliente en este envío */
  newFiles: File[];
  /** Paths ya subidos previamente que el cliente conserva (avance parcial) */
  existingPaths: string[];
}

/** Decodifica el valor de UN campo desde FormData, según su tipo. */
export function decodeSectionFormValue(field: FormFieldSchema, formData: FormData): unknown {
  if (field.type === 'file_upload' || field.type === 'image_upload') {
    const newFiles = formData
      .getAll(field.key)
      .filter((v): v is File => v instanceof File && v.size > 0);
    const existingPaths = formData.getAll(`${field.key}__existing`).map(String);
    return { newFiles, existingPaths } satisfies DecodedFileValue;
  }

  if (field.type === 'checkbox_group') {
    return formData.getAll(field.key).map(String);
  }

  if (field.type === 'financial_product') {
    const raw = formData.get(field.key);
    if (!raw) return [];
    try {
      return JSON.parse(String(raw));
    } catch {
      return [];
    }
  }

  if (field.type === 'switch') {
    return formData.get(field.key) === 'true';
  }

  if (field.type === 'number') {
    const raw = formData.get(field.key);
    return raw === null || raw === '' ? null : Number(raw);
  }

  const raw = formData.get(field.key);
  return raw === null ? '' : String(raw);
}
