-- ============================================
-- MIGRATION: clients_org_document_index
-- Description: Índice compuesto para localizar rápidamente un cliente por
--   documento dentro de su organización (búsqueda estructural). No existía
--   ningún índice cubriendo (organization_id, document_slug, document_number).
-- Date: 2026-09-13
-- ============================================

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_clients_org_document
  ON public.clients(organization_id, document_slug, document_number);
