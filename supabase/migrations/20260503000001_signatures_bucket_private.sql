-- ============================================
-- MIGRATION: signatures_bucket_private
-- Description: Make signatures bucket private and add RLS policies
--              so only the file owner can read/write their own signatures
-- Date: 2026-05-03
-- ============================================

-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'signatures';

-- 2. DROP existing policies (public bucket may have had open policies)
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own signatures" ON storage.objects;

-- 3. RLS policies for private bucket — owner-only access
CREATE POLICY "signatures: owner can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signatures' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "signatures: owner can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "signatures: owner can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'signatures' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role (used by admin client) always has full access via Supabase internals.
