import type { CatalogOptionsSource, FormFieldOption, FormFieldSchema, FormSection } from './types';

export const CATALOG_OPTIONS_SOURCES: Record<CatalogOptionsSource, { label: string }> = {
  catalog_banks: { label: 'Bancos (configurados por la organización)' },
  catalog_documents: { label: 'Tipos de documento (configurados por la organización)' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

/** Con `organizationId`, resuelve contra las tablas propias de la
 *  organización (`banks`/`documents`, administradas en Ajustes → Bancos /
 *  Ajustes → Documentos) — mismo criterio que ya usa el flujo legacy
 *  (`getLegalProcessBanks`/`getLegalProcessDocumentTypes`), y el `value` de
 *  cada opción pasa a ser el `id` real (FK directa a esas tablas). Sin
 *  `organizationId` cae al catálogo global de super_admin (`catalog_banks`/
 *  `catalog_documents`, `value = code`/`slug`) — usado solo para la vista
 *  previa del builder, que no está atada a una organización. */
async function fetchCatalogOptions(
  source: CatalogOptionsSource,
  supabase: Supabase,
  organizationId?: string,
): Promise<FormFieldOption[]> {
  if (source === 'catalog_banks') {
    if (organizationId) {
      const { data } = await supabase
        .from('banks')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      return (data ?? []).map((b: { id: string; name: string | null }) => ({ value: b.id, label: b.name ?? 'Banco' }));
    }

    const { data } = await supabase
      .from('catalog_banks')
      .select('code, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // El value guardado es el `code` (identificador oficial del banco, usado
    // en la variable de documento BANKING.CODE) — no el slug, que solo servía
    // como identificador interno sin una variable de documento equivalente.
    return (data ?? []).map((b: { code: string; name: string }) => ({ value: b.code, label: b.name }));
  }

  if (organizationId) {
    // `documents.name` es `json` (no `jsonb`) — Postgres no tiene operador de
    // ordenamiento para ese tipo (error 42883), así que se ordena por `slug`
    // (texto) en su lugar. Mismo motivo por el que el flujo legado
    // (getLegalProcessDocumentTypes) tampoco ordena por `name` ahí.
    const { data } = await supabase
      .from('documents')
      .select('id, name, slug')
      .eq('organization_id', organizationId)
      .order('slug', { ascending: true });

    return (data ?? []).map((d: { id: string; name: { es?: string; en?: string } | null; slug: string }) => ({
      value: d.id,
      label: d.name?.es ?? d.slug,
    }));
  }

  const { data } = await supabase
    .from('catalog_documents')
    .select('slug, name')
    .eq('is_active', true)
    .order('slug', { ascending: true });

  return (data ?? []).map((d: { slug: string; name: { es?: string; en?: string } | null }) => ({
    value: d.slug,
    label: d.name?.es ?? d.slug,
  }));
}

/** Resuelve, para un array de campos, las `options` de los que declaran
 *  `optionsSource` — contra el catálogo propio de `organizationId` (uso real,
 *  formulario público del cliente). Usa un caché por fuente dentro de la
 *  misma llamada, para no repetir consultas si varios campos comparten el
 *  mismo catálogo (ej. dos selects de "Banco" en distintas secciones). */
export async function resolveFieldOptions(
  fields: FormFieldSchema[],
  supabase: Supabase,
  organizationId: string,
): Promise<FormFieldSchema[]> {
  const cache = new Map<CatalogOptionsSource, FormFieldOption[]>();

  return Promise.all(
    fields.map(async (field) => {
      if (!field.optionsSource) return field;
      if (!cache.has(field.optionsSource)) {
        cache.set(field.optionsSource, await fetchCatalogOptions(field.optionsSource, supabase, organizationId));
      }
      return { ...field, options: cache.get(field.optionsSource) };
    }),
  );
}

export async function resolveSectionOptions(
  section: FormSection,
  supabase: Supabase,
  organizationId: string,
): Promise<FormSection> {
  return { ...section, fields: await resolveFieldOptions(section.fields, supabase, organizationId) };
}

/** Trae ambos catálogos globales de una vez, para resolver options
 *  client-side sin round-trips adicionales (usado en la vista previa del
 *  builder, donde el schema en edición vive en estado local del cliente). */
export async function fetchAllCatalogOptions(
  supabase: Supabase,
): Promise<Record<CatalogOptionsSource, FormFieldOption[]>> {
  const [banks, documents] = await Promise.all([
    fetchCatalogOptions('catalog_banks', supabase),
    fetchCatalogOptions('catalog_documents', supabase),
  ]);

  return { catalog_banks: banks, catalog_documents: documents };
}
