-- ============================================
-- MIGRATION: org_approval_status
-- Description: Beta approval gate — organizations must be approved by a
--   superadmin before their members can use the app. Adds
--   legal_representative_name, backfills existing orgs to 'active', and
--   constrains status to pending|active|rejected. Updates handle_new_user()
--   so a fresh (non-invited) signup lands in 'pending' with the company
--   name and legal representative name captured at signup.
-- Date: 2026-09-07
-- ============================================

-- 1. ALTER TABLE
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_representative_name text;

-- Backfill: every organization that existed before this gate goes live
-- immediately as 'active' — only new signups from now on start 'pending'.
UPDATE public.organizations
  SET status = 'active'
  WHERE status IS NULL OR status = 'draft';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('pending', 'active', 'rejected'));

ALTER TABLE public.organizations
  ALTER COLUMN status SET DEFAULT 'pending';

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

-- ============================================
-- handle_new_user(): default (non-invited) signups now start 'pending' and
-- capture company_name / legal_representative_name from auth signup metadata.
-- Invited signups are unaffected — they join an org that is already approved.
-- ============================================
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
    -- Default flow: create a new organization for this user, pending approval
    INSERT INTO public.organizations (status, created_by, name, legal_representative_name)
    VALUES (
      'pending',
      new.id,
      new.raw_user_meta_data->>'company_name',
      new.raw_user_meta_data->>'legal_representative_name'
    )
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, email, phone, current_organization_id)
    VALUES (new.id, new.email, new.phone, new_org_id);

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, new.id, 'ORG_ADMIN');
  END IF;

  RETURN new;
END;
$$;
