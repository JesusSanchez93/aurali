ALTER TABLE public.legal_process_clients
  ADD COLUMN IF NOT EXISTS doc_validation_status TEXT
    CHECK (doc_validation_status IN ('pending', 'valid', 'invalid', 'error')),
  ADD COLUMN IF NOT EXISTS doc_validation_details JSONB,
  ADD COLUMN IF NOT EXISTS doc_validated_at TIMESTAMPTZ;
