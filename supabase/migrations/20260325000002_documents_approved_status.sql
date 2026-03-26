-- =============================================================================
-- Add 'documents_approved' to legal_processes status CHECK constraint
-- =============================================================================

ALTER TABLE public.legal_processes
  DROP CONSTRAINT legal_processes_status_check;

ALTER TABLE public.legal_processes
  ADD CONSTRAINT legal_processes_status_check
  CHECK (status IN (
    'draft',
    'form_sent',
    'completed',
    'approved',
    'paid',
    'documents_approved',
    'documents_sent',
    'documents_received',
    'finished'
  ));
