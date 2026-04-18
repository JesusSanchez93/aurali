-- ─── Google OAuth: cambiar de per-organización a per-usuario ─────────────────
-- Cada abogado/usuario configura su propia cuenta de Google.

-- Añadir columna user_id
ALTER TABLE public.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Eliminar constraint único de organization_id y reemplazar por user_id
ALTER TABLE public.google_oauth_tokens
  DROP CONSTRAINT IF EXISTS google_oauth_tokens_organization_id_key;

ALTER TABLE public.google_oauth_tokens
  ADD CONSTRAINT google_oauth_tokens_user_id_key UNIQUE (user_id);

-- organization_id pasa a ser opcional (contexto, no clave)
ALTER TABLE public.google_oauth_tokens
  ALTER COLUMN organization_id DROP NOT NULL;

-- Actualizar políticas RLS para usar user_id en lugar de org
DROP POLICY IF EXISTS "google_oauth_tokens_org_members_select" ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "google_oauth_tokens_org_admin_insert"   ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "google_oauth_tokens_org_admin_update"   ON public.google_oauth_tokens;
DROP POLICY IF EXISTS "google_oauth_tokens_org_admin_delete"   ON public.google_oauth_tokens;

-- Cada usuario solo ve y gestiona su propio token
CREATE POLICY "google_oauth_tokens_own_select"
  ON public.google_oauth_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "google_oauth_tokens_own_insert"
  ON public.google_oauth_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "google_oauth_tokens_own_update"
  ON public.google_oauth_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "google_oauth_tokens_own_delete"
  ON public.google_oauth_tokens FOR DELETE
  USING (user_id = auth.uid());
