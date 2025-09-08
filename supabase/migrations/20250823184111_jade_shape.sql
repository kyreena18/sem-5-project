-- First, check if the bucket exists and create it if it doesn't
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internship-documents',
  'internship-documents', 
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads internship" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads internship" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates internship" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes internship" ON storage.objects;

-- Create RLS policies for internship-documents bucket
CREATE POLICY "Allow authenticated uploads internship" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internship-documents');

CREATE POLICY "Allow public downloads internship" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'internship-documents');

CREATE POLICY "Allow authenticated updates internship" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'internship-documents');

CREATE POLICY "Allow authenticated deletes internship" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'internship-documents');

-- Also allow public users to upload (in case authentication is not working properly)
CREATE POLICY "Allow public uploads internship" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'internship-documents');

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'internship-documents';