-- ============================================
-- MIGRATION: catalog_tables_anon_select
-- Description: Permite lectura anónima de los catálogos globales de bancos
--   y tipos de documento — datos de referencia no sensibles, necesarios para
--   que un select del Dynamic Form Builder con optionsSource='catalog_banks'
--   o 'catalog_documents' muestre opciones reales en el formulario público
--   (el cliente externo no tiene sesión de Supabase, solo rol anon).
-- Date: 2026-09-12
-- ============================================

-- 4. CREATE POLICIES
CREATE POLICY "catalog_banks_select_anon"
  ON public.catalog_banks
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "catalog_documents_select_anon"
  ON public.catalog_documents
  FOR SELECT TO anon
  USING (is_active = true);
