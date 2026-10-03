-- ============================================
-- MIGRATION: support_access_requests
-- Description: El personal de Aurali (SUPERADMIN) ya no entra libremente a
--   una organización: solicita acceso, los administradores de
--   la organización (permiso `settings.manage`) reciben una notificación
--   (en la app y por correo) y lo aprueban o rechazan. El acceso aprobado
--   dura hasta que el superadmin sale de la organización o un
--   administrador lo revoca; para volver a entrar hace falta otra
--   aprobación. Todo queda en audit_logs.
--   - `organization_access_requests`: las solicitudes y su estado.
--   - `notifications`: notificaciones dentro de la app (primer uso).
--   - El trigger de `profiles` impide al superadmin fijar como activa una
--     organización sin acceso aprobado, y `my_permissions` no le da
--     permisos en ella. Las vistas globales de superadmin (RLS con
--     is_superadmin()) no cambian.
-- Date: 2026-10-02
-- ============================================

-- 1. CREATE TABLE

CREATE TABLE IF NOT EXISTS public.organization_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  -- 'access': acceso normal. 'control': la organización ve en vivo la
  -- actividad del superadmin (support_session_events).
  mode text NOT NULL DEFAULT 'access' CHECK (mode IN ('access', 'control')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'ended', 'revoked')),
  decided_at timestamptz,
  ended_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Business fields
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.organization_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_organization_access_requests_organization_id
  ON public.organization_access_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_access_requests_requested_by
  ON public.organization_access_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_organization_access_requests_decided_by
  ON public.organization_access_requests(decided_by);
CREATE INDEX IF NOT EXISTS idx_organization_access_requests_org_status
  ON public.organization_access_requests(organization_id, status);
-- Una sola solicitud abierta (pendiente o aprobada) por persona y organización.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_access_requests_one_open
  ON public.organization_access_requests(organization_id, requested_by)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id
  ON public.notifications(organization_id);

-- 3.1 FUNCIONES

-- ¿El usuario actual (superadmin) tiene acceso aprobado y vigente a la organización?
CREATE OR REPLACE FUNCTION public.has_active_org_access(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_access_requests r
    WHERE r.organization_id = p_org_id
      AND r.requested_by = auth.uid()
      AND r.status = 'approved'
  );
END;
$$;

-- Quiénes pueden aprobar (permiso settings.manage en la organización).
CREATE OR REPLACE FUNCTION public.org_access_approvers(p_org_id uuid)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_superadmin() AND NOT has_permission(p_org_id, 'settings.manage') THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT m.user_id, p.email
    FROM public.organization_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.organization_id = p_org_id
      AND m.active
      AND role_grants(m.role_id, 'settings.manage');
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_display_name(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT NULLIF(btrim(concat_ws(' ', firstname, lastname)), '') INTO v_name
  FROM public.profiles WHERE id = p_user_id;
  RETURN COALESCE(v_name, 'Equipo de Aurali');
END;
$$;

-- El superadmin solicita acceso. Devuelve la solicitud abierta (nueva o existente).
CREATE OR REPLACE FUNCTION public.request_org_access(p_org_id uuid, p_mode text DEFAULT 'access')
RETURNS TABLE (request_id uuid, request_status text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.organization_access_requests%ROWTYPE;
  v_name text;
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Solo el personal de Aurali puede solicitar acceso' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'La organización no existe' USING ERRCODE = '23503';
  END IF;
  IF p_mode NOT IN ('access', 'control') THEN
    RAISE EXCEPTION 'Modo de acceso no válido' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_request
  FROM public.organization_access_requests
  WHERE organization_id = p_org_id
    AND requested_by = auth.uid()
    AND status IN ('pending', 'approved');

  IF FOUND THEN
    -- Mientras siga pendiente, puede cambiar el modo pedido.
    IF v_request.status = 'pending' AND v_request.mode <> p_mode THEN
      UPDATE public.organization_access_requests
      SET mode = p_mode, updated_at = now()
      WHERE id = v_request.id;
      UPDATE public.notifications
      SET body = staff_display_name(auth.uid()) || CASE WHEN p_mode = 'control'
            THEN ' quiere ingresar a tu organización y tomar el control. Verás en vivo todo lo que haga.'
            ELSE ' quiere ingresar a tu organización.' END
      WHERE type = 'support_access_request' AND data->>'request_id' = v_request.id::text;
    END IF;
    RETURN QUERY SELECT v_request.id, v_request.status, false;
    RETURN;
  END IF;

  INSERT INTO public.organization_access_requests (organization_id, requested_by, mode)
  VALUES (p_org_id, auth.uid(), p_mode)
  RETURNING * INTO v_request;

  v_name := staff_display_name(auth.uid());

  INSERT INTO public.notifications (user_id, organization_id, type, title, body, data)
  SELECT a.user_id, p_org_id, 'support_access_request',
         CASE WHEN p_mode = 'control'
           THEN 'Solicitud de acceso y control del equipo de Aurali'
           ELSE 'Solicitud de acceso del equipo de Aurali' END,
         v_name || CASE WHEN p_mode = 'control'
           THEN ' quiere ingresar a tu organización y tomar el control. Verás en vivo todo lo que haga.'
           ELSE ' quiere ingresar a tu organización.' END,
         jsonb_build_object('request_id', v_request.id, 'mode', p_mode)
  FROM org_access_approvers(p_org_id) a;

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
  VALUES (p_org_id, auth.uid(), 'support_access_requested', 'organization_access_request', v_request.id,
          jsonb_build_object('staff_name', v_name, 'mode', p_mode));

  RETURN QUERY SELECT v_request.id, v_request.status, true;
END;
$$;

-- Un administrador de la organización aprueba o rechaza.
CREATE OR REPLACE FUNCTION public.decide_org_access(p_request_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.organization_access_requests%ROWTYPE;
  v_org_name text;
BEGIN
  SELECT * INTO v_request FROM public.organization_access_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe' USING ERRCODE = '23503';
  END IF;
  IF NOT has_permission(v_request.organization_id, 'settings.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para responder esta solicitud' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitud ya fue respondida' USING ERRCODE = '23514';
  END IF;

  UPDATE public.organization_access_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  -- La solicitud deja de estar pendiente para todos los aprobadores.
  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE type = 'support_access_request'
    AND data->>'request_id' = p_request_id::text;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_request.organization_id;

  INSERT INTO public.notifications (user_id, organization_id, type, title, body, data)
  VALUES (
    v_request.requested_by,
    v_request.organization_id,
    CASE WHEN p_approve THEN 'support_access_approved' ELSE 'support_access_rejected' END,
    CASE WHEN p_approve THEN 'Acceso aprobado' ELSE 'Acceso rechazado' END,
    COALESCE(v_org_name, 'La organización') ||
      CASE WHEN p_approve THEN ' aprobó tu solicitud de acceso.' ELSE ' rechazó tu solicitud de acceso.' END,
    jsonb_build_object('request_id', p_request_id)
  );

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
  VALUES (v_request.organization_id, auth.uid(),
          CASE WHEN p_approve THEN 'support_access_approved' ELSE 'support_access_rejected' END,
          'organization_access_request', p_request_id,
          jsonb_build_object('staff_name', staff_display_name(v_request.requested_by)));
END;
$$;

-- Un administrador corta un acceso aprobado; el superadmin sale de inmediato.
CREATE OR REPLACE FUNCTION public.revoke_org_access(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.organization_access_requests%ROWTYPE;
  v_org_name text;
BEGIN
  SELECT * INTO v_request FROM public.organization_access_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud no existe' USING ERRCODE = '23503';
  END IF;
  IF NOT has_permission(v_request.organization_id, 'settings.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para revocar este acceso' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'approved' THEN
    RAISE EXCEPTION 'Este acceso ya no está activo' USING ERRCODE = '23514';
  END IF;

  UPDATE public.organization_access_requests
  SET status = 'revoked', ended_at = now(), updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.profiles
  SET current_organization_id = NULL
  WHERE id = v_request.requested_by
    AND current_organization_id = v_request.organization_id;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_request.organization_id;

  INSERT INTO public.notifications (user_id, organization_id, type, title, body, data)
  VALUES (v_request.requested_by, v_request.organization_id, 'support_access_revoked', 'Acceso revocado',
          COALESCE(v_org_name, 'La organización') || ' revocó tu acceso.',
          jsonb_build_object('request_id', p_request_id));

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
  VALUES (v_request.organization_id, auth.uid(), 'support_access_revoked', 'organization_access_request', p_request_id,
          jsonb_build_object('staff_name', staff_display_name(v_request.requested_by)));
END;
$$;

-- El superadmin sale de la organización: su acceso termina.
CREATE OR REPLACE FUNCTION public.end_my_org_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_request_id uuid;
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Solo el personal de Aurali' USING ERRCODE = '42501';
  END IF;

  SELECT current_organization_id INTO v_org_id FROM public.profiles WHERE id = auth.uid();

  UPDATE public.profiles SET current_organization_id = NULL WHERE id = auth.uid();

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.organization_access_requests
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE organization_id = v_org_id
    AND requested_by = auth.uid()
    AND status = 'approved'
  RETURNING id INTO v_request_id;

  IF v_request_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
    VALUES (v_org_id, auth.uid(), 'support_access_ended', 'organization_access_request', v_request_id,
            jsonb_build_object('staff_name', staff_display_name(auth.uid())));
  END IF;
END;
$$;

-- Permisos efectivos: el superadmin solo recibe permisos en una organización
-- ajena si tiene acceso aprobado; en las suyas propias, los de su rol.
CREATE OR REPLACE FUNCTION public.my_permissions(p_org_id uuid)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_superadmin() AND (p_org_id IS NULL OR has_active_org_access(p_org_id)) THEN
    RETURN QUERY SELECT p.key FROM public.permissions p WHERE p.is_active;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT p.key
    FROM public.organization_members m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.active
      AND p.is_active;
END;
$$;

-- El superadmin no puede fijar como activa una organización ajena sin acceso aprobado.
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
    IF NEW.current_organization_id IS DISTINCT FROM OLD.current_organization_id
       AND NEW.current_organization_id IS NOT NULL
       AND NOT is_org_member(NEW.current_organization_id)
       AND NOT has_active_org_access(NEW.current_organization_id) THEN
      RAISE EXCEPTION 'Necesitas la aprobación de la organización para ingresar'
        USING ERRCODE = '42501';
    END IF;
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

-- Superadmins que hoy están dentro de una organización ajena salen: para
-- volver a entrar necesitan la aprobación del nuevo flujo.
UPDATE public.profiles p
SET current_organization_id = NULL
WHERE p.system_role = 'SUPERADMIN'
  AND p.current_organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = p.current_organization_id
      AND m.user_id = p.id
      AND m.active
  );

-- 4. CREATE POLICIES
-- Las escrituras de ambas tablas solo ocurren dentro de las funciones de arriba.
DO $$
BEGIN
  -- Transparencia: cualquier miembro ve las solicitudes de su organización.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_access_requests' AND policyname = 'Members and staff can view access requests') THEN
    CREATE POLICY "Members and staff can view access requests"
      ON public.organization_access_requests FOR SELECT TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view their own notifications') THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update their own notifications') THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.organization_access_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO anon, authenticated, service_role;
