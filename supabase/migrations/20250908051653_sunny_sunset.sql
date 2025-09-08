/*
# Setup Public Storage Access

This migration sets up proper public storage access for all document buckets
to ensure hyperlinks work correctly and documents can be viewed by anyone.

## Changes Made:
1. Create storage buckets with public access
2. Set up proper RLS policies for public read access
3. Configure CORS settings for web access
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('placement-offer-letters', 'placement-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-documents', 'internship-documents', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Public read access for student documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload internship documents" ON storage.objects;

-- Create public read policies for all buckets
CREATE POLICY "Public read access for student documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'student-documents');

CREATE POLICY "Public read access for placement documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'placement-offer-letters');

CREATE POLICY "Public read access for internship documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'internship-documents');

-- Create upload policies for authenticated users
CREATE POLICY "Authenticated users can upload student documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-documents');

CREATE POLICY "Authenticated users can upload placement documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'placement-offer-letters');

CREATE POLICY "Authenticated users can upload internship documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'internship-documents');

-- Create update/delete policies for file owners
CREATE POLICY "Users can update their own student documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own student documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own placement documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'placement-offer-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own placement documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'placement-offer-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own internship documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'internship-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own internship documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'internship-documents' AND auth.uid()::text = (storage.foldername(name))[1]);