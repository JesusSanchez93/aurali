-- ============================================
-- MIGRATION: email_follow_ups_form_resolution
-- Description: Adds 'form' as a third resolution_mode for email_follow_ups —
--   used when the send_email node is the client_form invitation email
--   (email_template = 'client_form_email'). Resolved when the client
--   completes the public form (updateInfoAboutEventsAction resumes the
--   workflow from the client_form node), mirroring how 'receipt' is
--   resolved by signature-actions.ts on document approval.
-- Date: 2026-09-11
-- ============================================

-- 1. ALTER TABLE

ALTER TABLE public.email_follow_ups
  DROP CONSTRAINT IF EXISTS email_follow_ups_resolution_mode_check;

ALTER TABLE public.email_follow_ups
  ADD CONSTRAINT email_follow_ups_resolution_mode_check
  CHECK (resolution_mode IN ('reply', 'receipt', 'form'));
