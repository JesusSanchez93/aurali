/**
 * Listados que una organización administra en Configuración.
 *
 * - `global`: aplica a toda organización, sin importar sus procesos.
 * - `process`: solo aplica si la organización tiene activo un tipo de
 *   proceso que lo declara en `workflow_templates.required_catalogs`
 *   (se asocia desde Flujos de trabajo, en modo superadmin).
 *
 * Para sumar un listado nuevo: agregar su entrada aquí (y su página de
 * Configuración). Aparece solo en la configuración del proceso y el menú lo
 * muestra a las organizaciones que correspondan.
 *
 * Módulo sin dependencias de servidor: se puede importar desde el cliente.
 */
export const ORG_CATALOGS = {
  documents: {
    label: 'Tipos de documento',
    description: 'Documentos de identidad que acepta la organización.',
    scope: 'global',
    settingsUrl: '/settings/documents',
    formSource: 'catalog_documents',
  },
  banks: {
    label: 'Bancos',
    description: 'Entidades bancarias con las que trabaja la organización.',
    scope: 'process',
    settingsUrl: '/settings/banks',
    formSource: 'catalog_banks',
  },
} as const satisfies Record<string, {
  label: string
  description: string
  scope: 'global' | 'process'
  settingsUrl: string
  /** `optionsSource` con el que los formularios dinámicos leen este listado. */
  formSource: string
}>

export type OrgCatalogKey = keyof typeof ORG_CATALOGS

export const ORG_CATALOG_KEYS = Object.keys(ORG_CATALOGS) as OrgCatalogKey[]

export const GLOBAL_CATALOG_KEYS = ORG_CATALOG_KEYS.filter((key) => ORG_CATALOGS[key].scope === 'global')

/** Listados que un tipo de proceso puede declarar como propios. */
export const PROCESS_CATALOG_KEYS = ORG_CATALOG_KEYS.filter((key) => ORG_CATALOGS[key].scope === 'process')

export function isProcessCatalogKey(value: string): value is OrgCatalogKey {
  return (PROCESS_CATALOG_KEYS as string[]).includes(value)
}

/** Listados propios que usan los campos de un formulario dinámico (por su `optionsSource`). */
export function processCatalogsInFormSchema(schema: unknown): OrgCatalogKey[] {
  const serialized = JSON.stringify(schema ?? {})
  return PROCESS_CATALOG_KEYS.filter((key) => serialized.includes(`"${ORG_CATALOGS[key].formSource}"`))
}
