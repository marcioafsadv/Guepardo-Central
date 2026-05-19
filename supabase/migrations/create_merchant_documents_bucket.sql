-- Create the merchant-documents storage bucket (public read so URLs work without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-documents',
  'merchant-documents',
  true,
  20971520, -- 20 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (admins) to upload/update files in this bucket
CREATE POLICY "Admin can upload merchant documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchant-documents');

CREATE POLICY "Admin can update merchant documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'merchant-documents');

-- Allow public read access so document URLs are accessible
CREATE POLICY "Public can read merchant documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'merchant-documents');
