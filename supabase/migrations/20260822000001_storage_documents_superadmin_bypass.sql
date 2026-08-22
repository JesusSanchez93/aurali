-- ============================================================
-- MIGRATION: storage_documents_superadmin_bypass
-- Description: Allow superadmins to read/write the `documents`
--   storage bucket regardless of org membership, matching the
--   is_superadmin() bypass already granted on every table-level
--   RLS policy for legal_process_clients / legal_process_banks.
--   Without this, createSignedUrl() silently fails for a
--   superadmin viewing a legal process outside their own active
--   organization, leaving client-uploaded ID images unrenderable
--   in the dashboard.
-- Date: 2026-08-22
-- ============================================================

DROP POLICY IF EXISTS "auth_select_documents" ON storage.objects;
CREATE POLICY "auth_select_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      public.is_superadmin()
      OR (storage.foldername(name))[1] IN (
        SELECT organization_id::text
        FROM public.organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

DROP POLICY IF EXISTS "auth_upload_documents" ON storage.objects;
CREATE POLICY "auth_upload_documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (
      public.is_superadmin()
      OR (storage.foldername(name))[1] IN (
        SELECT organization_id::text
        FROM public.organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

DROP POLICY IF EXISTS "auth_delete_documents" ON storage.objects;
CREATE POLICY "auth_delete_documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      public.is_superadmin()
      OR (storage.foldername(name))[1] IN (
        SELECT organization_id::text
        FROM public.organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );
