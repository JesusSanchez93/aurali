-- Add signature_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- ─── Signatures storage bucket ────────────────────────────────────────────────
-- Public read so Puppeteer can load the image when generating PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true,
  5242880,  -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload/replace their own signature (path: {user_id}/signature.png)
CREATE POLICY "Users can manage own signature"
  ON storage.objects FOR ALL
  TO authenticated
  USING   (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone (including Puppeteer running server-side) can read signatures
CREATE POLICY "Signatures are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'signatures');
