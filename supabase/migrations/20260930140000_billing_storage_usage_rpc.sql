-- ============================================
-- MIGRATION: billing_storage_usage_rpc
-- Description: Función RPC para medir en vivo el almacenamiento usado por
--   una organización en el bucket `documents` (prefijo `{organization_id}/`)
--   — lib/billing/usage.ts la usa en vez de consultar storage.objects
--   directamente, ya que ese schema no está tipado en database.types.ts.
-- Date: 2026-09-30
-- ============================================

-- 1. CREATE FUNCTION
CREATE OR REPLACE FUNCTION public.org_storage_bytes(p_organization_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE bucket_id = 'documents'
    AND name LIKE p_organization_id::text || '/%';
$$;

-- 5. GRANT PERMISSIONS
REVOKE ALL ON FUNCTION public.org_storage_bytes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_storage_bytes(uuid) TO service_role;
