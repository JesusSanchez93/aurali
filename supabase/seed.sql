-- =============================================================================
-- Seed: Superadmin user
-- Email:    jdavidsanchez1993@gmail.com
-- Password: aJdsan123.*
-- =============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Skip if already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'jdavidsanchez1993@gmail.com') THEN
    RAISE NOTICE 'Superadmin already exists — skipping.';
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'jdavidsanchez1993@gmail.com',
    crypt('aJdsan123.*', gen_salt('bf')),
    now(),
    now(),
    now(),
    '', '', '', ''
  );

  -- The handle_new_user trigger creates the profile automatically.
  -- Promote to SUPERADMIN and fill profile data.
  UPDATE public.profiles
  SET
    system_role       = 'SUPERADMIN',
    firstname         = 'Jesus',
    lastname          = 'Sanchez',
    phone             = '+573042455392',
    onboarding_status = 'completed'
  WHERE id = v_user_id;

  RAISE NOTICE 'Superadmin created: %', v_user_id;
END $$;
