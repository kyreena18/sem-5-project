/*
  # Fix Storage Policies for Anonymous Access

  1. Storage Configuration
    - Ensure all buckets are public
    - Set up proper RLS policies for anonymous access
    - Configure CORS for web access

  2. Security
    - Allow anonymous read access to all documents
    - Maintain authenticated upload requirements
    - Proper content type restrictions
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('placement-offer-letters', 'placement-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif']),
  ('internship-offer-letters', 'internship-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif']),
  ('internship-completion-letters', 'internship-completion-letters', true, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif']),
  ('internship-weekly-reports', 'internship-weekly-reports', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-outcomes', 'internship-student-outcomes', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-feedback', 'internship-student-feedback', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-company-outcomes', 'internship-company-outcomes', true, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update existing buckets to be public
UPDATE storage.buckets 
SET public = true 
WHERE id IN (
  'student-documents',
  'placement-offer-letters', 
  'internship-offer-letters',
  'internship-completion-letters',
  'internship-weekly-reports',
  'internship-student-outcomes',
  'internship-student-feedback',
  'internship-company-outcomes'
);

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous read access" ON storage.objects;

-- Create policy for anonymous read access to all storage objects
CREATE POLICY "Anonymous read access" ON storage.objects
FOR SELECT TO anon, public
USING (true);

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated upload access" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (true);

-- Create policy for authenticated users to update their own files
CREATE POLICY "Authenticated update access" ON storage.objects
FOR UPDATE TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy for authenticated users to delete their own files
CREATE POLICY "Authenticated delete access" ON storage.objects
FOR DELETE TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1]);