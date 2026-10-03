import type { createClient } from '@/lib/supabase/server'
import { GLOBAL_CATALOG_KEYS, isProcessCatalogKey, type OrgCatalogKey } from './registry'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Listados que aplican a una organización: los globales más los que declaran
 * sus tipos de proceso activos.
 */
export async function getOrgCatalogKeys(supabase: Supabase, organizationId: string): Promise<OrgCatalogKey[]> {
  const { data, error } = await supabase
    .from('organization_workflows')
    .select('workflow_templates(required_catalogs)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const keys = new Set<OrgCatalogKey>(GLOBAL_CATALOG_KEYS)
  for (const row of data ?? []) {
    for (const key of row.workflow_templates?.required_catalogs ?? []) {
      if (isProcessCatalogKey(key)) keys.add(key)
    }
  }
  return [...keys]
}
