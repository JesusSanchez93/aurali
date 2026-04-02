-- Fix anon SELECT policy on legal_processes.
-- The original policy only allowed status = 'form_sent', but processes start with
-- status = 'draft' (access_token is set at creation), so the validate-token flow
-- was failing for all newly created processes.
-- Allow anon to read any process that has an access_token (shared with client).
-- The cookie/token check at the application layer handles authorization.

DROP POLICY IF EXISTS "public_read_pending_process" ON public.legal_processes;

CREATE POLICY "public_read_pending_process"
  ON public.legal_processes FOR SELECT TO anon
  USING (access_token IS NOT NULL);
