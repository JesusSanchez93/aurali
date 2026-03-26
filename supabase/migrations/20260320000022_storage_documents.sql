-- =============================================================================
-- Storage bucket: documents
-- Path structure: {organization_id}/{legal_process_id}/filename
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated: members upload/view/delete within their org folder
CREATE POLICY "auth_upload_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "auth_select_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "auth_delete_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text
      FROM public.organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Anon: public client form can upload/update files for active legal processes
-- Uses SECURITY DEFINER function to bypass anon RLS on legal_processes
CREATE POLICY "anon_upload_documents"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_active_legal_process_path(name)
  );

CREATE POLICY "anon_update_documents"
  ON storage.objects FOR UPDATE TO anon
  USING (
    bucket_id = 'documents'
    AND public.is_active_legal_process_path(name)
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_active_legal_process_path(name)
  );
