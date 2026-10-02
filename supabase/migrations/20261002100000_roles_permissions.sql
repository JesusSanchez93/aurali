-- ============================================
-- MIGRATION: roles_permissions
-- Description: Sistema de roles y permisos multi-tenant.
--   - `permissions`: catálogo global de permisos (lo administra el SUPERADMIN).
--   - `roles`: una sola tabla; `organization_id IS NULL` = rol oficial de
--     Aurali, con valor = rol personalizado de esa organización.
--     `source_role_id` recuerda de qué rol partió una personalización.
--   - `role_permissions`: permisos de cada rol.
--   - `organization_members.role_id` / `organization_invitations.role_id`.
--     La columna de texto `role` (ORG_ADMIN/ORG_USER) se conserva y pasa a
--     derivarse del rol nuevo, para no romper el código que aún la lee.
--   - `has_permission()` es la fuente de verdad en RLS; `is_org_admin()` se
--     redefine sobre ella (permiso `settings.manage`), así las políticas que
--     aún la usan siguen funcionando sin reescribirse.
--   - Los roles personalizados requieren la feature de plan `custom_roles`
--     (`plans.features`), verificada también en RLS.
-- Date: 2026-10-02
-- ============================================

-- 1. CREATE TABLE

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Business fields
  key text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  source_synced_at timestamptz,
  permissions_updated_at timestamptz NOT NULL DEFAULT now(),

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roles_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT roles_code_only_system CHECK (code IS NULL OR organization_id IS NULL)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;

-- 1.1 Seed del catálogo de permisos
INSERT INTO public.permissions (key, resource, action, name, description, sort_order) VALUES
  ('cases.view',        'cases',     'view',      'Ver',       'Ver los procesos legales de la organización.', 10),
  ('cases.create',      'cases',     'create',    'Crear',     'Crear procesos legales.', 11),
  ('cases.update',      'cases',     'update',    'Editar',    'Editar y avanzar procesos legales.', 12),
  ('cases.delete',      'cases',     'delete',    'Eliminar',  'Eliminar procesos legales.', 13),
  ('clients.view',      'clients',   'view',      'Ver',       'Ver los clientes de la organización.', 20),
  ('clients.create',    'clients',   'create',    'Crear',     'Registrar clientes.', 21),
  ('clients.update',    'clients',   'update',    'Editar',    'Editar clientes.', 22),
  ('clients.delete',    'clients',   'delete',    'Eliminar',  'Eliminar clientes.', 23),
  ('documents.view',    'documents', 'view',      'Ver',       'Ver documentos generados y plantillas.', 30),
  ('documents.create',  'documents', 'create',    'Crear',     'Generar documentos.', 31),
  ('documents.update',  'documents', 'update',    'Editar',    'Editar documentos.', 32),
  ('documents.delete',  'documents', 'delete',    'Eliminar',  'Eliminar documentos.', 33),
  ('documents.sign',    'documents', 'sign',      'Firmar',    'Firmar y solicitar firmas de documentos.', 34),
  ('payments.view',     'payments',  'view',      'Ver',       'Ver honorarios y pagos de los procesos.', 40),
  ('payments.manage',   'payments',  'manage',    'Gestionar', 'Establecer honorarios y registrar o eliminar pagos.', 41),
  ('reports.financial', 'reports',   'financial', 'Reportes financieros', 'Ver los valores económicos en Analíticas.', 50),
  ('users.view',        'users',     'view',      'Ver',       'Ver el equipo y las invitaciones pendientes.', 60),
  ('users.create',      'users',     'create',    'Invitar',   'Invitar nuevos miembros a la organización.', 61),
  ('users.update',      'users',     'update',    'Editar',    'Cambiar el rol de un miembro y activarlo o desactivarlo.', 62),
  ('users.delete',      'users',     'delete',    'Eliminar',  'Eliminar miembros de la organización.', 63),
  ('roles.manage',      'roles',     'manage',    'Gestionar', 'Crear y personalizar roles (según el plan).', 70),
  ('settings.manage',   'settings',  'manage',    'Gestionar', 'Administrar la configuración de la organización: correo, flujos y datos del bufete.', 80),
  ('audit.view',        'audit',     'view',      'Ver',       'Ver el registro de auditoría de la organización.', 90)
ON CONFLICT (key) DO NOTHING;

-- 1.2 Seed de los roles oficiales de Aurali
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_system_code
  ON public.roles(code) WHERE code IS NOT NULL;

INSERT INTO public.roles (organization_id, code, name, description)
SELECT NULL, v.code, v.name, v.description
FROM (VALUES
  ('admin',     'Administrador', 'Acceso completo a la organización, incluido el equipo y la configuración.'),
  ('lawyer',    'Abogado',       'Gestiona procesos, clientes, documentos y pagos.'),
  ('assistant', 'Asistente',     'Apoya en procesos, clientes y documentos, sin firmar ni eliminar.')
) AS v(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.code = v.code);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON
  (r.code = 'admin')
  OR (r.code = 'lawyer' AND p.key IN (
    'cases.view', 'cases.create', 'cases.update',
    'clients.view', 'clients.create', 'clients.update',
    'documents.view', 'documents.create', 'documents.update', 'documents.sign',
    'payments.view', 'payments.manage'
  ))
  OR (r.code = 'assistant' AND p.key IN (
    'cases.view', 'cases.create', 'cases.update',
    'clients.view', 'clients.create', 'clients.update',
    'documents.view', 'documents.create'
  ))
WHERE r.organization_id IS NULL AND r.code IN ('admin', 'lawyer', 'assistant')
ON CONFLICT DO NOTHING;

-- 1.3 Backfill: ORG_ADMIN → Administrador, ORG_USER → Abogado
UPDATE public.organization_members m
SET role_id = (
  SELECT id FROM public.roles
  WHERE code = CASE WHEN m.role = 'ORG_ADMIN' THEN 'admin' ELSE 'lawyer' END
)
WHERE m.role_id IS NULL;

UPDATE public.organization_invitations i
SET role_id = (
  SELECT id FROM public.roles
  WHERE code = CASE WHEN i.role = 'ORG_ADMIN' THEN 'admin' ELSE 'lawyer' END
)
WHERE i.role_id IS NULL;

ALTER TABLE public.organization_members ALTER COLUMN role_id SET NOT NULL;

-- 1.4 Feature de plan: roles personalizados
UPDATE public.plans
SET features = (COALESCE(features::jsonb, '{}'::jsonb) || '{"custom_roles": true}'::jsonb)::json
WHERE code = 'professional';

UPDATE public.plans
SET features = (COALESCE(features::jsonb, '{}'::jsonb) || '{"custom_roles": false}'::jsonb)::json
WHERE code = 'essential';

-- 2. ENABLE RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_permissions_resource
  ON public.permissions(resource, sort_order);
CREATE INDEX IF NOT EXISTS idx_roles_organization_id
  ON public.roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_source_role_id
  ON public.roles(source_role_id);
CREATE INDEX IF NOT EXISTS idx_roles_created_by
  ON public.roles(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_system_name
  ON public.roles(lower(name)) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_org_name
  ON public.roles(organization_id, lower(name)) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id
  ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role_id
  ON public.organization_members(role_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_role_id
  ON public.organization_invitations(role_id);

-- 3.1 FUNCIONES DE AUTORIZACIÓN (SECURITY DEFINER — leen sin pasar por RLS)

CREATE OR REPLACE FUNCTION public.role_grants(p_role_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = p_role_id
      AND p.key = p_key
      AND p.is_active
  );
END;
$$;

-- Fuente de verdad: ¿el usuario actual tiene este permiso en ESTA organización?
CREATE OR REPLACE FUNCTION public.has_permission(p_org_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.active
      AND p.key = p_key
      AND p.is_active
  );
END;
$$;

-- Permisos efectivos del usuario actual en una organización (para el servidor
-- de la app). El SUPERADMIN recibe todos.
CREATE OR REPLACE FUNCTION public.my_permissions(p_org_id uuid)
RETURNS SETOF text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_superadmin() THEN
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

CREATE OR REPLACE FUNCTION public.org_plan_has_feature(p_org_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT (pl.features::jsonb ->> p_feature)::boolean
    FROM public.organization_subscriptions s
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.organization_id = p_org_id
  ), false);
END;
$$;

-- Valor de la columna de texto heredada, derivado del rol nuevo.
CREATE OR REPLACE FUNCTION public.legacy_role_for(p_role_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN CASE WHEN role_grants(p_role_id, 'settings.manage') THEN 'ORG_ADMIN' ELSE 'ORG_USER' END;
END;
$$;

-- Las políticas que aún usan is_org_admin() pasan a depender del rol nuevo.
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN has_permission(p_org_id, 'settings.manage');
END;
$$;

-- 3.2 GUARDS (anti-escalación, aislamiento entre organizaciones, bloqueo)

CREATE OR REPLACE FUNCTION public.roles_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_org uuid;
  v_source_changed boolean;
  v_user_initiated boolean := auth.uid() IS NOT NULL AND NOT is_superadmin();
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.code IS NOT NULL AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Los roles base de Aurali no se pueden eliminar' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'Un rol no puede cambiar de organización' USING ERRCODE = '42501';
    END IF;
    IF NEW.code IS DISTINCT FROM OLD.code AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'El código de un rol no se puede modificar' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
  ELSIF v_user_initiated THEN
    NEW.code := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_source_changed := NEW.source_role_id IS NOT NULL;
  ELSE
    v_source_changed := NEW.source_role_id IS NOT NULL
      AND NEW.source_role_id IS DISTINCT FROM OLD.source_role_id;
  END IF;

  IF v_source_changed THEN
    SELECT organization_id INTO v_source_org FROM public.roles WHERE id = NEW.source_role_id;
    IF NOT FOUND
       OR (v_source_org IS NOT NULL AND v_source_org IS DISTINCT FROM NEW.organization_id) THEN
      RAISE EXCEPTION 'El rol de origen no pertenece a esta organización' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Valida el rol asignado a un miembro o a una invitación.
CREATE OR REPLACE FUNCTION public.assert_assignable_role(p_org_id uuid, p_role_id uuid, p_check_actor boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_org uuid;
BEGIN
  SELECT organization_id INTO v_role_org FROM public.roles WHERE id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El rol no existe' USING ERRCODE = '23503';
  END IF;

  IF v_role_org IS NOT NULL AND v_role_org <> p_org_id THEN
    RAISE EXCEPTION 'El rol pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  IF p_check_actor AND auth.uid() IS NOT NULL AND NOT is_superadmin() THEN
    IF EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = p_role_id
        AND p.is_active
        AND NOT has_permission(p_org_id, p.key)
    ) THEN
      RAISE EXCEPTION 'No puedes asignar un rol con permisos que tú no tienes' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_role_id_for_legacy(p_legacy_role text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE code = CASE WHEN p_legacy_role = 'ORG_ADMIN' THEN 'admin' ELSE 'lawyer' END;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Faltan los roles base de Aurali';
  END IF;
  RETURN v_role_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.organization_members_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_changed boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION 'Una membresía no puede cambiar de organización ni de usuario' USING ERRCODE = '42501';
  END IF;

  -- Inserciones que aún solo conocen la columna de texto (p. ej. el alta).
  IF NEW.role_id IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'El rol indicado no existe o no es visible para ti' USING ERRCODE = '23503';
    END IF;
    NEW.role_id := default_role_id_for_legacy(NEW.role);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_role_changed := true;
  ELSE
    v_role_changed := NEW.role_id IS DISTINCT FROM OLD.role_id;
  END IF;

  PERFORM assert_assignable_role(NEW.organization_id, NEW.role_id, v_role_changed);

  NEW.role := legacy_role_for(NEW.role_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.organization_invitations_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_changed boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Una invitación no puede cambiar de organización' USING ERRCODE = '42501';
  END IF;

  IF NEW.role_id IS NULL THEN
    NEW.role_id := default_role_id_for_legacy(NEW.role);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_role_changed := true;
  ELSE
    v_role_changed := NEW.role_id IS DISTINCT FROM OLD.role_id;
  END IF;

  PERFORM assert_assignable_role(NEW.organization_id, NEW.role_id, v_role_changed);

  NEW.role := legacy_role_for(NEW.role_id);
  RETURN NEW;
END;
$$;

-- Una organización no puede quedarse sin nadie capaz de gestionar el equipo.
-- Solo aplica a cambios hechos por usuarios (no a SUPERADMIN ni service role).
CREATE OR REPLACE FUNCTION public.assert_org_keeps_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR is_superadmin() THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = p_org_id
      AND m.active
      AND role_grants(m.role_id, 'users.update')
  ) THEN
    RAISE EXCEPTION 'La organización debe conservar al menos un miembro activo que pueda gestionar el equipo'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.organization_members_keep_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM assert_org_keeps_admin(OLD.organization_id);
  ELSE
    PERFORM assert_org_keeps_admin(NEW.organization_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.role_permissions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM public.roles WHERE id = OLD.role_id;
  IF FOUND AND v_code = 'admin' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'El rol Administrador siempre conserva todos los permisos' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

-- Tras cambiar los permisos de un rol: resincroniza la columna de texto
-- heredada de sus miembros, marca el rol como modificado y audita.
CREATE OR REPLACE FUNCTION public.role_permissions_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_permission_id uuid;
  v_role public.roles%ROWTYPE;
  v_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_role_id := OLD.role_id;
    v_permission_id := OLD.permission_id;
  ELSE
    v_role_id := NEW.role_id;
    v_permission_id := NEW.permission_id;
  END IF;

  -- Si el rol ya no existe, es el borrado en cascada del propio rol.
  SELECT * INTO v_role FROM public.roles WHERE id = v_role_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT key INTO v_key FROM public.permissions WHERE id = v_permission_id;

  UPDATE public.roles SET permissions_updated_at = now() WHERE id = v_role_id;

  IF v_key = 'settings.manage' THEN
    UPDATE public.organization_members
    SET role = legacy_role_for(role_id)
    WHERE role_id = v_role_id;
  END IF;

  IF v_role.organization_id IS NULL
     OR EXISTS (SELECT 1 FROM public.organizations WHERE id = v_role.organization_id) THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
    VALUES (
      v_role.organization_id,
      auth.uid(),
      CASE WHEN TG_OP = 'DELETE' THEN 'role_permission_removed' ELSE 'role_permission_added' END,
      'role',
      v_role_id,
      jsonb_build_object('role_name', v_role.name, 'permission', v_key, 'system_role', v_role.organization_id IS NULL)
    );
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.role_permissions_keep_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.roles WHERE id = OLD.role_id;
  IF v_org_id IS NOT NULL THEN
    PERFORM assert_org_keeps_admin(v_org_id);
  END IF;
  RETURN NULL;
END;
$$;

-- 3.3 AUDITORÍA

CREATE OR REPLACE FUNCTION public.roles_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.roles%ROWTYPE;
  v_action text;
  v_previous_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
    v_action := 'role_deleted';
    -- Borrado en cascada de la organización: no queda a qué asociar el registro.
    IF v_row.organization_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_row.organization_id) THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_row := NEW;
    v_action := 'role_created';
  ELSE
    v_row := NEW;
    v_action := 'role_updated';
    v_previous_name := OLD.name;
  END IF;

  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    v_row.organization_id,
    auth.uid(),
    v_action,
    'role',
    v_row.id,
    jsonb_build_object(
      'role_name', v_row.name,
      'system_role', v_row.organization_id IS NULL,
      'source_role_id', v_row.source_role_id,
      'previous_name', v_previous_name
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.organization_members_role_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
  VALUES (
    NEW.organization_id,
    auth.uid(),
    'member_role_changed',
    'organization_member',
    NEW.id,
    jsonb_build_object(
      'member_user_id', NEW.user_id,
      'from_role_id', OLD.role_id,
      'from_role', (SELECT name FROM public.roles WHERE id = OLD.role_id),
      'to_role_id', NEW.role_id,
      'to_role', (SELECT name FROM public.roles WHERE id = NEW.role_id)
    )
  );
  RETURN NULL;
END;
$$;

-- 3.4 GUARDADO ATÓMICO DE UN ROL
-- SECURITY INVOKER a propósito: todo pasa por RLS y por los guards. Crea o
-- renombra el rol y deja exactamente `p_permission_keys` como sus permisos,
-- en una sola transacción (el chequeo de "queda un administrador" se evalúa
-- al final).
CREATE OR REPLACE FUNCTION public.save_role(
  p_role_id uuid,
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_source_role_id uuid,
  p_permission_keys text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
  v_keys text[] := COALESCE(p_permission_keys, ARRAY[]::text[]);
BEGIN
  IF p_role_id IS NULL THEN
    INSERT INTO public.roles (organization_id, name, description, source_role_id, source_synced_at, created_by)
    VALUES (
      p_organization_id,
      btrim(p_name),
      NULLIF(btrim(COALESCE(p_description, '')), ''),
      p_source_role_id,
      CASE WHEN p_source_role_id IS NOT NULL THEN now() END,
      auth.uid()
    )
    RETURNING id INTO v_role_id;
  ELSE
    UPDATE public.roles
    SET name = btrim(p_name),
        description = NULLIF(btrim(COALESCE(p_description, '')), '')
    WHERE id = p_role_id
    RETURNING id INTO v_role_id;

    IF v_role_id IS NULL THEN
      RAISE EXCEPTION 'No tienes permiso para modificar este rol' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Primero se agregan y luego se quitan: así quien edita su propio rol no
  -- pierde `roles.manage` a mitad de la operación.
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, p.id
  FROM public.permissions p
  WHERE p.key = ANY (v_keys)
    AND p.is_active
    AND NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = v_role_id AND rp.permission_id = p.id
    );

  DELETE FROM public.role_permissions rp
  USING public.permissions p
  WHERE rp.permission_id = p.id
    AND rp.role_id = v_role_id
    AND NOT (p.key = ANY (v_keys));

  RETURN v_role_id;
END;
$$;

-- 3.5 TRIGGERS (se crean después del seed y del backfill para no auditarlos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'roles_guard' AND tgrelid = 'public.roles'::regclass) THEN
    CREATE TRIGGER roles_guard
      BEFORE INSERT OR UPDATE OR DELETE ON public.roles
      FOR EACH ROW EXECUTE FUNCTION public.roles_guard();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'roles_audit_insert_delete' AND tgrelid = 'public.roles'::regclass) THEN
    CREATE TRIGGER roles_audit_insert_delete
      AFTER INSERT OR DELETE ON public.roles
      FOR EACH ROW EXECUTE FUNCTION public.roles_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'roles_audit_update' AND tgrelid = 'public.roles'::regclass) THEN
    CREATE TRIGGER roles_audit_update
      AFTER UPDATE ON public.roles
      FOR EACH ROW
      WHEN (
        OLD.name IS DISTINCT FROM NEW.name
        OR OLD.description IS DISTINCT FROM NEW.description
        OR OLD.is_active IS DISTINCT FROM NEW.is_active
      )
      EXECUTE FUNCTION public.roles_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'role_permissions_guard' AND tgrelid = 'public.role_permissions'::regclass) THEN
    CREATE TRIGGER role_permissions_guard
      BEFORE DELETE ON public.role_permissions
      FOR EACH ROW EXECUTE FUNCTION public.role_permissions_guard();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'role_permissions_after_change' AND tgrelid = 'public.role_permissions'::regclass) THEN
    CREATE TRIGGER role_permissions_after_change
      AFTER INSERT OR DELETE ON public.role_permissions
      FOR EACH ROW EXECUTE FUNCTION public.role_permissions_after_change();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'role_permissions_keep_admin' AND tgrelid = 'public.role_permissions'::regclass) THEN
    CREATE CONSTRAINT TRIGGER role_permissions_keep_admin
      AFTER DELETE ON public.role_permissions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION public.role_permissions_keep_admin();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'organization_members_role_guard' AND tgrelid = 'public.organization_members'::regclass) THEN
    CREATE TRIGGER organization_members_role_guard
      BEFORE INSERT OR UPDATE ON public.organization_members
      FOR EACH ROW EXECUTE FUNCTION public.organization_members_role_guard();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'organization_members_keep_admin' AND tgrelid = 'public.organization_members'::regclass) THEN
    CREATE CONSTRAINT TRIGGER organization_members_keep_admin
      AFTER UPDATE OR DELETE ON public.organization_members
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION public.organization_members_keep_admin();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'organization_members_role_audit' AND tgrelid = 'public.organization_members'::regclass) THEN
    CREATE TRIGGER organization_members_role_audit
      AFTER UPDATE ON public.organization_members
      FOR EACH ROW
      WHEN (OLD.role_id IS DISTINCT FROM NEW.role_id)
      EXECUTE FUNCTION public.organization_members_role_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'organization_invitations_role_guard' AND tgrelid = 'public.organization_invitations'::regclass) THEN
    CREATE TRIGGER organization_invitations_role_guard
      BEFORE INSERT OR UPDATE ON public.organization_invitations
      FOR EACH ROW EXECUTE FUNCTION public.organization_invitations_role_guard();
  END IF;
END $$;

-- 3.6 El alta por invitación respeta el rol (incluido uno personalizado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id     UUID;
  invite_org     UUID;
  invite_role    TEXT;
  invite_role_id UUID;
BEGIN
  -- Check for a pending, unexpired invitation for this email
  SELECT organization_id, role, role_id INTO invite_org, invite_role, invite_role_id
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

    INSERT INTO public.organization_members (organization_id, user_id, role, role_id)
    VALUES (invite_org, new.id, COALESCE(invite_role, 'ORG_USER'), invite_role_id)
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

-- 4. CREATE POLICIES
DO $$
BEGIN
  -- 4.1 permissions — catálogo legible por cualquier usuario autenticado; solo el SUPERADMIN escribe
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'Authenticated users can view permissions') THEN
    CREATE POLICY "Authenticated users can view permissions"
      ON public.permissions FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'Superadmin can create permissions') THEN
    CREATE POLICY "Superadmin can create permissions"
      ON public.permissions FOR INSERT TO authenticated
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'Superadmin can update permissions') THEN
    CREATE POLICY "Superadmin can update permissions"
      ON public.permissions FOR UPDATE TO authenticated
      USING (is_superadmin())
      WITH CHECK (is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'Superadmin can delete permissions') THEN
    CREATE POLICY "Superadmin can delete permissions"
      ON public.permissions FOR DELETE TO authenticated
      USING (is_superadmin());
  END IF;

  -- 4.2 roles — oficiales visibles para todos; personalizados solo para su organización.
  --     Escribir un rol de organización exige `roles.manage` Y la feature de plan.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'Users can view system roles and roles from their organization') THEN
    CREATE POLICY "Users can view system roles and roles from their organization"
      ON public.roles FOR SELECT TO authenticated
      USING (organization_id IS NULL OR is_org_member(organization_id) OR is_superadmin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'Role managers can create roles in their organization') THEN
    CREATE POLICY "Role managers can create roles in their organization"
      ON public.roles FOR INSERT TO authenticated
      WITH CHECK (
        is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND has_permission(organization_id, 'roles.manage')
          AND org_plan_has_feature(organization_id, 'custom_roles')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'Role managers can update roles in their organization') THEN
    CREATE POLICY "Role managers can update roles in their organization"
      ON public.roles FOR UPDATE TO authenticated
      USING (
        is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND has_permission(organization_id, 'roles.manage')
          AND org_plan_has_feature(organization_id, 'custom_roles')
        )
      )
      WITH CHECK (
        is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND has_permission(organization_id, 'roles.manage')
          AND org_plan_has_feature(organization_id, 'custom_roles')
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'Role managers can delete roles in their organization') THEN
    CREATE POLICY "Role managers can delete roles in their organization"
      ON public.roles FOR DELETE TO authenticated
      USING (
        is_superadmin()
        OR (
          organization_id IS NOT NULL
          AND has_permission(organization_id, 'roles.manage')
          AND org_plan_has_feature(organization_id, 'custom_roles')
        )
      );
  END IF;

  -- 4.3 role_permissions — además, nadie concede un permiso que no tiene
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'Users can view permissions of visible roles') THEN
    CREATE POLICY "Users can view permissions of visible roles"
      ON public.role_permissions FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.roles r
          WHERE r.id = role_permissions.role_id
            AND (r.organization_id IS NULL OR is_org_member(r.organization_id) OR is_superadmin())
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'Role managers can grant permissions they hold') THEN
    CREATE POLICY "Role managers can grant permissions they hold"
      ON public.role_permissions FOR INSERT TO authenticated
      WITH CHECK (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM public.roles r
          JOIN public.permissions p ON p.id = role_permissions.permission_id
          WHERE r.id = role_permissions.role_id
            AND r.organization_id IS NOT NULL
            AND p.is_active
            AND has_permission(r.organization_id, 'roles.manage')
            AND org_plan_has_feature(r.organization_id, 'custom_roles')
            AND has_permission(r.organization_id, p.key)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'Role managers can revoke permissions in their organization') THEN
    CREATE POLICY "Role managers can revoke permissions in their organization"
      ON public.role_permissions FOR DELETE TO authenticated
      USING (
        is_superadmin()
        OR EXISTS (
          SELECT 1
          FROM public.roles r
          WHERE r.id = role_permissions.role_id
            AND r.organization_id IS NOT NULL
            AND has_permission(r.organization_id, 'roles.manage')
            AND org_plan_has_feature(r.organization_id, 'custom_roles')
        )
      );
  END IF;
END $$;

-- 4.4 Políticas existentes que pasan de "es admin" a un permiso concreto
ALTER POLICY "org_members_insert" ON public.organization_members
  WITH CHECK (is_superadmin() OR has_permission(organization_id, 'users.create'));

ALTER POLICY "org_members_update" ON public.organization_members
  USING (is_superadmin() OR has_permission(organization_id, 'users.update'))
  WITH CHECK (is_superadmin() OR has_permission(organization_id, 'users.update'));

ALTER POLICY "org_members_delete" ON public.organization_members
  USING (is_superadmin() OR has_permission(organization_id, 'users.delete'));

ALTER POLICY "org_invitations_select" ON public.organization_invitations
  USING (is_superadmin() OR has_permission(organization_id, 'users.view'));

ALTER POLICY "org_invitations_insert" ON public.organization_invitations
  WITH CHECK (is_superadmin() OR has_permission(organization_id, 'users.create'));

ALTER POLICY "org_invitations_update" ON public.organization_invitations
  USING (is_superadmin() OR has_permission(organization_id, 'users.create'))
  WITH CHECK (is_superadmin() OR has_permission(organization_id, 'users.create'));

ALTER POLICY "org_invitations_delete" ON public.organization_invitations
  USING (is_superadmin() OR has_permission(organization_id, 'users.create'));

ALTER POLICY "legal_processes_delete" ON public.legal_processes
  USING (is_superadmin() OR has_permission(organization_id, 'cases.delete'));

ALTER POLICY "fees_delete" ON public.legal_process_fees
  USING (is_superadmin() OR has_permission(organization_id, 'payments.manage'));

ALTER POLICY "payments_delete" ON public.legal_process_payments
  USING (is_superadmin() OR has_permission(organization_id, 'payments.manage'));

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.roles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.role_permissions TO anon, authenticated, service_role;
