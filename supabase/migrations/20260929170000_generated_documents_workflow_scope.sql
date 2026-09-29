-- ============================================
-- MIGRATION: generated_documents_workflow_scope
-- Description: Agrega workflow_run_id/node_id a generated_documents para
--   poder saber qué nodo generate_document (y en qué corrida del flujo)
--   produjo cada documento. Sin esto, un nodo "Enviar Correo" con adjuntos
--   ofrecía TODOS los documentos no-preview del proceso legal, incluyendo
--   los generados por otros nodos generate_document anteriores en el mismo
--   flujo.
-- Date: 2026-09-29
-- ============================================

-- 1. ADD COLUMNS
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS node_id text;

-- 2. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_generated_documents_workflow_run_node
  ON public.generated_documents(workflow_run_id, node_id);
