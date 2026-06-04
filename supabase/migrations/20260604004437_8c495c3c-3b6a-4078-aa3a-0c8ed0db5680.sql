
CREATE POLICY "Public read tech-videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tech-videos');

CREATE POLICY "Public insert tech-videos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'tech-videos');

CREATE POLICY "Public update tech-videos"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'tech-videos');

CREATE POLICY "Public delete tech-videos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'tech-videos');
