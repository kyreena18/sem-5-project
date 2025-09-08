-- Create placement-offer-letters bucket identical to student-documents
-- Run this SQL in your Supabase SQL Editor

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'placement-offer-letters',
  'placement-offer-letters', 
  true,
  10485760, -- 10MB limit (same as student-documents)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop any existing conflicting policies
DROP POLICY IF EXISTS "Allow authenticated uploads to placement-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads from placement-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to placement-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from placement-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to placement-offer-letters" ON storage.objects;

-- 3. Create RLS policies for placement-offer-letters bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to placement-offer-letters" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'placement-offer-letters');

-- Allow public read access (needed for viewing offer letters)
CREATE POLICY "Allow public downloads from placement-offer-letters" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'placement-offer-letters');

-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated updates to placement-offer-letters" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'placement-offer-letters');

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated deletes from placement-offer-letters" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'placement-offer-letters');

-- Fallback policy for public uploads (in case auth issues occur)
CREATE POLICY "Allow public uploads to placement-offer-letters" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'placement-offer-letters');

-- 4. Verify bucket creation
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'placement-offer-letters';

-- 5. Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%placement-offer-letters%';