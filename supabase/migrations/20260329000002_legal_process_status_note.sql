-- Add optional note field for archive/decline actions
ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS status_note TEXT DEFAULT NULL;

COMMENT ON COLUMN public.legal_processes.status_note IS
  'Optional reason provided when a process is archived or declined. Cleared on revert.';
