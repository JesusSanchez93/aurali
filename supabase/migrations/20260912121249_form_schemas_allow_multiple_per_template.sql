-- ============================================
-- MIGRATION: form_schemas_allow_multiple_per_template
-- Description: Permite que un mismo workflow_template (tipo de flujo) tenga
--   más de un formulario dinámico publicado simultáneamente. La identidad de
--   "un formulario" y su unicidad al publicar pasa a ser por `code`
--   (uq_form_schemas_code_published, ya existente), no por workflow_template_id.
-- Date: 2026-09-12
-- ============================================

DROP INDEX IF EXISTS uq_form_schemas_published;
