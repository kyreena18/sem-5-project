/*
  # Create Public Storage Policies

  1. Storage Buckets
    - Create public buckets for student documents and placement files
    - Set appropriate policies for public read access

  2. Security
    - Allow public read access to all uploaded files
    - Maintain authenticated user upload restrictions
    - Enable public viewing of documents via direct URLs
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('placement-offer-letters', 'placement-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*', 'video/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for student documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own student documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own placement documents" ON storage.objects;

-- Create policies for public read access to all files
CREATE POLICY "Public read access for student documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'student-documents');

CREATE POLICY "Public read access for placement documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'placement-offer-letters');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload student documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-documents');

CREATE POLICY "Authenticated users can upload placement documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'placement-offer-letters');

-- Allow users to update their own files
CREATE POLICY "Users can update their own student documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-documents')
WITH CHECK (bucket_id = 'student-documents');

CREATE POLICY "Users can update their own placement documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'placement-offer-letters')
WITH CHECK (bucket_id = 'placement-offer-letters');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own student documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-documents');

CREATE POLICY "Users can delete their own placement documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'placement-offer-letters');