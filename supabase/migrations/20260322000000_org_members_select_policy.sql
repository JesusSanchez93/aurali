-- Allow any active member of an org to see other members in the same org
-- (needed for the "Assigned to" lawyer dropdown in legal process creation)
-- Uses is_org_member() SECURITY DEFINER to avoid infinite recursion.
DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;

CREATE POLICY "org_members_select"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR is_org_admin(organization_id)
    OR is_org_member(organization_id)
  );
