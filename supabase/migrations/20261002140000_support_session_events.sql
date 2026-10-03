-- ============================================
-- MIGRATION: support_session_events
-- Description: Actividad del superadmin dentro de una organización cuando
--   entró en modo "control" (organization_access_requests.mode = 'control'):
--   cada página que abre y cada acción que ejecuta (nombre del control, nunca
--   lo escrito en los campos). La organización la ve en vivo (Realtime).
--   Solo el superadmin con acceso de control vigente puede registrar
--   eventos, y solo para esa solicitud.
-- Date: 2026-10-02
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.support_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.organization_access_requests(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Business fields
  kind text NOT NULL CHECK (kind IN ('navigation', 'action')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  path text CHECK (path IS NULL OR char_length(path) <= 300),

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.support_session_events ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_support_session_events_organization_id
  ON public.support_session_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_session_events_request_id
  ON public.support_session_events(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_session_events_actor_id
  ON public.support_session_events(actor_id);

-- 4. CREATE POLICIES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_session_events' AND policyname = 'Members and staff can view support session events') THEN
    CREATE POLICY "Members and staff can view support session events"
      ON public.support_session_events FOR SELECT TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_session_events' AND policyname = 'Staff in control mode can record their own events') THEN
    CREATE POLICY "Staff in control mode can record their own events"
      ON public.support_session_events FOR INSERT TO authenticated
      WITH CHECK (
        actor_id = auth.uid()
        AND is_superadmin()
        AND EXISTS (
          SELECT 1 FROM public.organization_access_requests r
          WHERE r.id = support_session_events.request_id
            AND r.organization_id = support_session_events.organization_id
            AND r.requested_by = auth.uid()
            AND r.status = 'approved'
            AND r.mode = 'control'
        )
      );
  END IF;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.support_session_events TO anon, authenticated, service_role;

-- Realtime: la organización ve la actividad en vivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_session_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_session_events;
  END IF;
END $$;
