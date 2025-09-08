-- Step 1: Create the internship-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internship-documents',
  'internship-documents', 
  true,
  10485760, -- 10MB limit (same as student-documents)
  ARRAY[
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png', 
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ]
);

-- Step 2: Create RLS policies for the internship-documents bucket

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to internship-documents" 
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'internship-documents');

-- Allow public read access (for viewing documents)
CREATE POLICY "Allow public downloads from internship-documents" 
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'internship-documents');

-- Allow authenticated users to update files
CREATE POLICY "Allow authenticated updates to internship-documents" 
ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'internship-documents');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes from internship-documents" 
ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'internship-documents');

-- Step 3: Verify the bucket was created successfully
SELECT * FROM storage.buckets WHERE id = 'internship-documents';

-- Step 4: Verify the policies were created successfully
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%internship-documents%';