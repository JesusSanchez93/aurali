-- =============================================================================
-- Add previous_status column to legal_processes
-- Stores the status before archiving so the action can be reverted.
-- =============================================================================

ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS previous_status TEXT DEFAULT NULL;
