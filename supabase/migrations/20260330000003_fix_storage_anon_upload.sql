-- Fix is_active_legal_process_path: add 'storage' to search_path so
-- storage.foldername() is accessible, and add exception handling for invalid UUIDs.
-- Also add anon SELECT policy on storage.objects so upsert (INSERT + UPDATE check)
-- can verify file existence without a 403.

CREATE OR REPLACE FUNCTION public.is_active_legal_process_path(object_name text)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  parts text[];
  process_id text;
BEGIN
  parts := storage.foldername(object_name);
  process_id := parts[2];

  IF process_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.legal_processes
    WHERE id::text = process_id
      AND status NOT IN ('completed', 'finished')
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Anon SELECT on storage.objects: needed for upsert to check file existence.
-- Restricted to the documents bucket and only files in active process paths.
CREATE POLICY "anon_select_documents"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'documents'
    AND public.is_active_legal_process_path(name)
  );
