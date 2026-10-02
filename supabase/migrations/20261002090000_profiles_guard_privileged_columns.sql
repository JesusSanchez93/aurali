-- ============================================
-- MIGRATION: profiles_guard_privileged_columns
-- Description: La política `profiles_update` deja a cada usuario actualizar
--   su propia fila sin restringir columnas, así que cualquiera podía
--   asignarse `system_role = 'SUPERADMIN'` o apuntar
--   `current_organization_id` a una organización ajena con una llamada
--   directa a Supabase. Este trigger bloquea ambos cambios salvo para
--   SUPERADMIN y para el service role (sin JWT de usuario).
-- Date: 2026-10-02
-- ============================================

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role, triggers de auth y migraciones no traen JWT de usuario.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF NEW.system_role IS DISTINCT FROM OLD.system_role THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol de sistema'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.current_organization_id IS DISTINCT FROM OLD.current_organization_id
     AND NEW.current_organization_id IS NOT NULL
     AND NOT is_org_member(NEW.current_organization_id) THEN
    RAISE EXCEPTION 'No perteneces a esa organización'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_guard_privileged_columns'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER profiles_guard_privileged_columns
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();
  END IF;
END $$;
