-- ============================================
-- MIGRATION: form_responses_instance_id
-- Description: Añade form_instance_id a legal_process_form_responses para
--   que las respuestas pertenezcan a una instancia de formulario (no sólo al
--   proceso), habilitando múltiples instancias del mismo formulario por
--   proceso (ver legal_process_form_instances). El constraint único legado
--   (legal_process_id, section_key) NO se elimina — sigue siendo válido para
--   el caso de un solo formulario por proceso; se añade un nuevo índice único
--   por (form_instance_id, section_key) para el código nuevo.
-- Date: 2026-09-13
-- ============================================

-- 1. ADD COLUMN
ALTER TABLE public.legal_process_form_responses
  ADD COLUMN IF NOT EXISTS form_instance_id UUID REFERENCES public.legal_process_form_instances(id) ON DELETE CASCADE;

-- Backfill: cada respuesta existente se asocia a la instancia "primary" del
-- mismo proceso (creada en la migración anterior a partir de
-- legal_processes.form_schema_id).
UPDATE public.legal_process_form_responses r
SET form_instance_id = fi.id
FROM public.legal_process_form_instances fi
WHERE fi.legal_process_id = r.legal_process_id
  AND fi.code = 'primary'
  AND r.form_instance_id IS NULL;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_form_responses_form_instance_id
  ON public.legal_process_form_responses(form_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_responses_instance_section
  ON public.legal_process_form_responses(form_instance_id, section_key)
  WHERE form_instance_id IS NOT NULL;

-- 4/5: sin cambios de policies/grants — las políticas existentes sobre
-- legal_process_form_responses ya resuelven por legal_process_id y siguen
-- siendo válidas independientemente de form_instance_id.
