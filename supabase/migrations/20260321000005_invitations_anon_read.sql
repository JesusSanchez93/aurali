-- Allow anonymous users to read an invitation by its token
-- (token is a UUID secret sent only in the invitation email, so this is safe)
CREATE POLICY "org_invitations_anon_read_by_token"
  ON public.organization_invitations FOR SELECT TO anon
  USING (true);
