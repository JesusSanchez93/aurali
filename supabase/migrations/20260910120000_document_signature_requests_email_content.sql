-- ============================================
-- MIGRATION: document_signature_requests_email_content
-- Description: Persists the exact subject and intro HTML used when the
--   signature-request email was first sent (lib/workflow/nodeExecutors.ts
--   executeSendDocuments), so the dashboard's manual resend action can
--   reproduce the identical email instead of reconstructing generic
--   default text.
-- Date: 2026-09-10
-- ============================================

-- 1. ADD COLUMNS

ALTER TABLE public.document_signature_requests ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.document_signature_requests ADD COLUMN IF NOT EXISTS email_intro_html text;
