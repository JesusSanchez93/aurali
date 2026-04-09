-- ─── AI Variables ─────────────────────────────────────────────────────────────
-- Variables personalizadas con prompt para generación IA en plantillas de documentos.

CREATE TABLE IF NOT EXISTS public.ai_variables (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  key             TEXT        NOT NULL,        -- ej: "AI_HECHOS_DEL_CASO" (prefijo AI_ requerido)
  prompt          TEXT        NOT NULL,        -- prompt que define el admin
  description     TEXT,
  organization_id UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by      UUID        REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

ALTER TABLE public.ai_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_variables_org_members_select"
  ON public.ai_variables FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "ai_variables_org_members_insert"
  ON public.ai_variables FOR INSERT
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "ai_variables_org_members_update"
  ON public.ai_variables FOR UPDATE
  USING (is_org_member(organization_id));

CREATE POLICY "ai_variables_org_admin_delete"
  ON public.ai_variables FOR DELETE
  USING (is_org_admin(organization_id));

GRANT ALL ON TABLE public.ai_variables TO anon, authenticated, service_role;
