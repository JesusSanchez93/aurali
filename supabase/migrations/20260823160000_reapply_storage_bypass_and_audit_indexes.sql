-- ============================================================
-- MIGRATION: reapply_storage_bypass_and_audit_indexes
-- Description: Re-applies the is_superadmin() bypass on the
--   `documents` storage bucket policies and the audit_logs
--   indexes. A stray auto-generated migration
--   (20260823150656_remote_schema.sql, since deleted) was applied
--   to production and reverted both changes before they were ever
--   confirmed live. This migration is idempotent (DROP POLICY IF
--   EXISTS + CREATE, CREATE INDEX IF NOT EXISTS) and safe to run
--   even if the prior state is already correct.
-- Date: 2026-08-23
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id
  ON public.audit_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_at
  ON public.audit_logs(organization_id, created_at DESC);
