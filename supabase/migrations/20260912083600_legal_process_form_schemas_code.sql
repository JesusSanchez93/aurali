-- ============================================
-- MIGRATION: legal_process_form_schemas_code
-- Description: Cada formulario dinámico (identidad estable a través de sus
--   versiones draft/publish) recibe un "code" corto, para que los nodos
--   send_email del workflow puedan referenciar explícitamente cuál formulario
--   deben enlazar/renderizar — necesario a futuro cuando un mismo flujo tenga
--   más de una recolección de datos (más de un formulario).
-- Date: 2026-09-12
-- ============================================

-- 1. ADD COLUMN (con default para que nuevas filas siempre tengan uno)
ALTER TABLE public.legal_process_form_schemas
  ADD COLUMN IF NOT EXISTS code TEXT
  DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

-- Backfill de filas existentes creadas antes de este default
UPDATE public.legal_process_form_schemas
  SET code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  WHERE code IS NULL;

ALTER TABLE public.legal_process_form_schemas
  ALTER COLUMN code SET NOT NULL;

-- 3. CREATE INDEXES
--
-- El code identifica al formulario (misma identidad a través de sus filas de
-- draft y publicado) — no debe ser único a nivel de tabla, porque el draft y
-- el publicado de un mismo formulario son DOS filas distintas que comparten
-- el mismo code. La única invariante real es que no haya dos formularios
-- PUBLICADOS con el mismo code (executeSendEmail busca por code + is_published).
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_schemas_code_published
  ON public.legal_process_form_schemas(code)
  WHERE is_published;
