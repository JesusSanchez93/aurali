-- =============================================================================
-- organization_invitations
-- =============================================================================

CREATE TABLE public.organization_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'ORG_USER'
                    CHECK (role IN ('ORG_ADMIN', 'ORG_USER')),
  token           UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_invitations_select"
  ON public.organization_invitations FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

CREATE POLICY "org_invitations_insert"
  ON public.organization_invitations FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_admin(organization_id));

CREATE POLICY "org_invitations_update"
  ON public.organization_invitations FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id))
  WITH CHECK (is_superadmin() OR is_org_admin(organization_id));

CREATE POLICY "org_invitations_delete"
  ON public.organization_invitations FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

GRANT ALL ON TABLE public.organization_invitations TO anon, authenticated, service_role;

-- =============================================================================
-- Update handle_new_user to accept invitations automatically
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id   UUID;
  invite_org   UUID;
  invite_role  TEXT;
BEGIN
  -- Check for a pending, unexpired invitation for this email
  SELECT organization_id, role INTO invite_org, invite_role
  FROM public.organization_invitations
  WHERE email = new.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_org IS NOT NULL THEN
    -- Join the invited organization (do not create a new one)
    INSERT INTO public.profiles (id, email, phone, current_organization_id)
    VALUES (new.id, new.email, new.phone, invite_org);

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (invite_org, new.id, COALESCE(invite_role, 'ORG_USER'))
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    -- Mark invitation as accepted
    UPDATE public.organization_invitations
    SET accepted_at = now()
    WHERE organization_id = invite_org
      AND email = new.email
      AND accepted_at IS NULL;

  ELSE
    -- Default flow: create a new organization for this user
    INSERT INTO public.organizations (status, created_by)
    VALUES ('draft', new.id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, email, phone, current_organization_id)
    VALUES (new.id, new.email, new.phone, new_org_id);

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, new.id, 'ORG_ADMIN');
  END IF;

  RETURN new;
END;
$$;
