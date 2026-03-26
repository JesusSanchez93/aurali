-- =============================================================================
-- Security helper functions (SECURITY DEFINER — bypass RLS internally)
-- LANGUAGE plpgsql: table references validated at execution time, not creation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND system_role = 'SUPERADMIN'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'ORG_ADMIN'
      AND active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_legal_process_path(object_name text)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.legal_processes
    WHERE id = (storage.foldername(object_name))[2]::uuid
      AND status NOT IN ('completed', 'finished')
  );
END;
$$;
