CREATE POLICY "Allow all authenticated users to manage files" ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
