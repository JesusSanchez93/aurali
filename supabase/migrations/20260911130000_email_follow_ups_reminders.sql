-- ============================================
-- MIGRATION: email_follow_ups_reminders
-- Description: Adds reminder-tracking columns to email_follow_ups so the
--   /api/cron/email-follow-ups job can tell how many reminder emails have
--   already gone out for a pending follow-up and avoid re-sending on every
--   run. Each reminder push also advances deadline_at by the node's
--   follow_up_value/unit, so the next cron pass waits a full interval
--   before sending the next one.
-- Date: 2026-09-11
-- ============================================

-- 1. ALTER TABLE

ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS reminder_sent_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.email_follow_ups
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
