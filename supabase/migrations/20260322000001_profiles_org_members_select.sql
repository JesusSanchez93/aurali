-- Allow members to see profiles of others in the same organization
-- Uses current_organization_id from the profile row + is_org_member() SECURITY DEFINER
-- to avoid infinite recursion.
CREATE POLICY "profiles_select_org_members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR auth.uid() = id
    OR is_org_member(current_organization_id)
  );
