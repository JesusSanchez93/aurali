import type { SupabaseClient } from '@supabase/supabase-js';
import type { FormSchema } from '@/lib/forms/types';

/**
 * Convierte un storage path de un campo file_upload/image_upload en una URL
 * firmada temporal — los valores guardados en legal_process_form_responses
 * son siempre el path crudo del bucket "documents", nunca una URL. Un valor
 * que ya empiece con "http" se deja tal cual (defensivo, no debería pasar).
 */
export async function signFormResponsePath(
  supabase: SupabaseClient,
  path: string,
): Promise<string> {
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
  if (error || !data) {
    console.error('createSignedUrl failed for form response file', path, error);
    return path;
  }
  return data.signedUrl;
}

/**
 * Sustituye, en las respuestas de un formulario dinámico, los paths de
 * Storage de campos file_upload/image_upload por URLs firmadas — mismo
 * patrón que se usa para document_front_image/document_back_image del flujo
 * legado. Muta `responses` in place.
 */
export async function resolveFormResponseFileUrls(
  supabase: SupabaseClient,
  schema: FormSchema,
  responses: Record<string, Record<string, unknown>>,
) {
  for (const section of schema.sections) {
    const data = responses[section.key];
    if (!data) continue;

    for (const field of section.fields) {
      if (field.type !== 'file_upload' && field.type !== 'image_upload') continue;
      const value = data[field.key];
      if (!value) continue;

      if (Array.isArray(value)) {
        data[field.key] = await Promise.all(
          value.map((p) => (typeof p === 'string' ? signFormResponsePath(supabase, p) : p)),
        );
      } else if (typeof value === 'string') {
        data[field.key] = await signFormResponsePath(supabase, value);
      }
    }
  }
}
