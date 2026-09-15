import { z } from 'zod';

import type { FormFieldSchema } from './types';
import { financialProductSchema } from './financialProduct';

/** Construye el validador Zod de un único campo, aplicando `validation` del schema. */
function buildFieldValidator(field: FormFieldSchema): z.ZodTypeAny {
  const { type, validation } = field;
  const required = validation?.required ?? false;

  switch (type) {
    case 'switch': {
      const schema = z.boolean();
      // Un switch nunca tocado por el cliente queda en `undefined` (no en
      // `false`) — sin required, debe aceptarse igual que cualquier otro
      // campo opcional, o Zod lo rechaza como "requerido" pese a no serlo.
      return required ? schema.refine((v) => v === true, { message: 'Este campo es requerido' }) : schema.optional();
    }

    case 'number': {
      let schema = z.coerce.number({ invalid_type_error: 'Debe ser un número' });
      if (validation?.min !== undefined) schema = schema.min(validation.min);
      if (validation?.max !== undefined) schema = schema.max(validation.max);
      return required ? schema : schema.optional();
    }

    case 'checkbox_group': {
      // Igual que switch: sin selección todavía el valor es `undefined`, no
      // un array vacío — debe aceptarse cuando el campo no es requerido.
      if (required) return z.array(z.string()).min(1, 'Selecciona al menos una opción');
      return z.array(z.string()).optional();
    }

    case 'financial_product': {
      if (required) return z.array(financialProductSchema).min(1, 'Agrega al menos un producto financiero');
      return z.array(financialProductSchema).optional();
    }

    case 'file_upload':
    case 'image_upload': {
      // El valor puede ser un File nuevo (cliente) o un path ya subido (string, al recargar
      // avance parcial). La validación estricta de tipo/tamaño se hace en el componente.
      const schema = z.union([z.instanceof(File), z.string(), z.array(z.union([z.instanceof(File), z.string()]))]);
      return required ? schema : schema.optional().nullable();
    }

    case 'text':
    case 'textarea':
    case 'select':
    case 'radio':
    case 'phone':
    case 'date':
    case 'audio_transcription':
    default: {
      let schema = z.string();
      if (validation?.minLength !== undefined) schema = schema.min(validation.minLength);
      if (validation?.maxLength !== undefined) schema = schema.max(validation.maxLength);
      if (validation?.pattern) schema = schema.regex(new RegExp(validation.pattern), 'Formato inválido');
      if (required) {
        return schema.min(1, 'Este campo es requerido');
      }
      return schema.optional().or(z.literal(''));
    }
  }
}

/** Construye dinámicamente un z.object() a partir de las FormFieldSchema de una sección,
 *  para validar el formulario público del cliente sin código hardcoded por campo. */
export function buildZodSchema(fields: FormFieldSchema[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.key] = buildFieldValidator(field);
  }
  return z.object(shape);
}
