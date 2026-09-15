-- ============================================
-- MIGRATION: form_schemas_organization_and_domain_sync
-- Description: Desacopla la pertenencia real de un formulario dinámico de
--   workflow_template_id. organization_id pasa a ser la fuente de verdad de
--   ownership; workflow_template_id se conserva únicamente para indicar en
--   qué workflow puede usarse el formulario (no para determinar de quién es).
--   domain_sync_key marca explícitamente qué formularios requieren
--   sincronización hacia tablas legacy de un dominio específico (ej.
--   'financial_fraud'); NULL (default) significa "ningún área nueva necesita
--   tocar tablas legacy" — ver lib/forms/domainSync/.
-- Date: 2026-09-13
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.legal_process_form_schemas
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.legal_process_form_schemas
  ADD COLUMN IF NOT EXISTS domain_sync_key TEXT;

-- Backfill: organization_id se deriva del workflow_template al que estaba
-- atado hasta ahora. Se deja NULL cuando el template es global
-- (workflow_templates.organization_id IS NULL) — no se fuerza NOT NULL,
-- porque un formulario podría legítimamente pertenecer a un template global
-- reutilizable por cualquier organización.
UPDATE public.legal_process_form_schemas fs
SET organization_id = wt.organization_id
FROM public.workflow_templates wt
WHERE wt.id = fs.workflow_template_id
  AND fs.organization_id IS NULL;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_form_schemas_organization_id
  ON public.legal_process_form_schemas(organization_id);

-- 4. CREATE POLICIES
--
-- Se añade una policy adicional de lectura basada en organization_id directo,
-- sin reemplazar "form_schemas_select_authenticated" (que sigue resolviendo
-- vía workflow_template_id para no romper el acceso hoy vigente). Esta nueva
-- policy permite que un miembro de la organización dueña del formulario lo
-- vea aunque el formulario todavía no esté enlazado a ningún
-- organization_workflows de esa organización (caso de reutilización futura).
CREATE POLICY "form_schemas_select_by_organization"
  ON public.legal_process_form_schemas
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND is_org_member(organization_id)
  );

-- 5. GRANT PERMISSIONS
-- (ya otorgados en la migración de creación de la tabla; sin cambios)
