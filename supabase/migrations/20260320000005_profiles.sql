-- =============================================================================
-- profiles + handle_new_user trigger
-- =============================================================================

CREATE TABLE public.profiles (
  id                      UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  firstname               VARCHAR,
  lastname                VARCHAR,
  email                   TEXT,
  phone                   TEXT,
  onboarding_status       TEXT,
  current_organization_id UUID,
  system_role             TEXT        NOT NULL DEFAULT 'USER'
                            CHECK (system_role IN ('SUPERADMIN', 'USER')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-create org + profile + membership on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id   UUID;
  member_count INTEGER;
  final_role   TEXT;
BEGIN
  INSERT INTO public.organizations (status, created_by)
  VALUES ('draft', new.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, email, phone, current_organization_id)
  VALUES (new.id, new.email, new.phone, new_org_id);

  SELECT COUNT(*) INTO member_count
  FROM public.organization_members
  WHERE organization_id = new_org_id;

  IF member_count = 0 THEN
    final_role := 'ORG_ADMIN';
  ELSE
    final_role := COALESCE(new.raw_user_meta_data->>'role', 'ORG_USER');
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, new.id, final_role);

  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_superadmin());

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR is_superadmin())
  WITH CHECK (auth.uid() = id OR is_superadmin());

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
