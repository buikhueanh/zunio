-- Storage bucket for listing photos (BUILDORDER 1.8).
--
-- Public READ: listing photos are public by design — the browse grid and the
-- SSR listing/profile pages are meant to be crawlable (CLAUDE.md wants Google
-- indexing), so signed read URLs would buy nothing and break SEO.
--
-- Writes are NOT public. Uploads happen exclusively through server-issued
-- signed upload URLs (app/api/listings/upload-url), which check session +
-- is_seller_verified + the per-listing photo cap BEFORE any bytes move. The
-- policies below are the second line of defense: even holding a valid signed
-- URL, a caller can only write inside their own {user_id}/ prefix.
--
-- allowed_mime_types deliberately excludes image/svg+xml: an SVG can carry
-- <script>, and serving it from the Storage origin would execute it there
-- (stored XSS). Raster formats only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  5242880, -- 5 MB; the client compresses well below this before uploading
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object paths are always "{user_id}/{uuid}.{ext}", so the first path segment
-- is the owner. storage.foldername() returns that segment array.
CREATE POLICY "public read listing images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

CREATE POLICY "users upload own listing images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users update own listing images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users delete own listing images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
