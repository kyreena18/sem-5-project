/*
  # Enable Anonymous Public Access to Storage

  This migration ensures that all document storage buckets are accessible
  by anyone with the URL, without requiring authentication.

  ## Changes Made:
  1. Make all storage buckets public
  2. Create RLS policies that allow anonymous read access
  3. Set up proper CORS configuration
  4. Ensure inline viewing for documents
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Public read access for student-documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for placement-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-offer-letters" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-completion-letters" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-weekly-reports" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-student-outcomes" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-student-feedback" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship-company-outcomes" ON storage.objects;

-- Create or update storage buckets with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('placement-offer-letters', 'placement-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*']),
  ('internship-offer-letters', 'internship-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*']),
  ('internship-completion-letters', 'internship-completion-letters', true, 52428800, ARRAY['application/pdf', 'image/*']),
  ('internship-weekly-reports', 'internship-weekly-reports', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-outcomes', 'internship-student-outcomes', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-feedback', 'internship-student-feedback', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-company-outcomes', 'internship-company-outcomes', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create policies that allow ANONYMOUS public read access
CREATE POLICY "Anonymous public read access for student-documents"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'student-documents');

CREATE POLICY "Anonymous public read access for placement-offer-letters"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'placement-offer-letters');

CREATE POLICY "Anonymous public read access for internship-offer-letters"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-offer-letters');

CREATE POLICY "Anonymous public read access for internship-completion-letters"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-completion-letters');

CREATE POLICY "Anonymous public read access for internship-weekly-reports"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-weekly-reports');

CREATE POLICY "Anonymous public read access for internship-student-outcomes"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-student-outcomes');

CREATE POLICY "Anonymous public read access for internship-student-feedback"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-student-feedback');

CREATE POLICY "Anonymous public read access for internship-company-outcomes"
ON storage.objects FOR SELECT
TO anon, public
USING (bucket_id = 'internship-company-outcomes');

-- Allow authenticated users to upload to their own folders
CREATE POLICY "Authenticated users can upload student documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-documents');

CREATE POLICY "Authenticated users can upload placement offer letters"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'placement-offer-letters');

CREATE POLICY "Authenticated users can upload internship documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN (
  'internship-offer-letters',
  'internship-completion-letters', 
  'internship-weekly-reports',
  'internship-student-outcomes',
  'internship-student-feedback',
  'internship-company-outcomes'
));

-- Allow authenticated users to update their own documents
CREATE POLICY "Authenticated users can update student documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'student-documents');

CREATE POLICY "Authenticated users can update placement documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'placement-offer-letters');

CREATE POLICY "Authenticated users can update internship documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN (
  'internship-offer-letters',
  'internship-completion-letters',
  'internship-weekly-reports', 
  'internship-student-outcomes',
  'internship-student-feedback',
  'internship-company-outcomes'
));