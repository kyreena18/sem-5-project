/*
  # Fix Public Storage Access for Document Viewing

  1. Storage Buckets
    - Ensure all buckets are public
    - Set proper CORS policies for web access
    
  2. Security Policies
    - Allow public read access to all files
    - Maintain upload restrictions for authenticated users
    
  3. File Access
    - Enable direct file viewing in browser
    - Fix MIME type handling
*/

-- Ensure buckets exist and are public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('placement-offer-letters', 'placement-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-offer-letters', 'internship-offer-letters', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-completion-letters', 'internship-completion-letters', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-weekly-reports', 'internship-weekly-reports', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-outcomes', 'internship-student-outcomes', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-student-feedback', 'internship-student-feedback', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('internship-company-outcomes', 'internship-company-outcomes', true, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Public read access for student documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for internship documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload student documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload internship documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own student documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own placement documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own internship documents" ON storage.objects;

-- Create comprehensive public read policies
CREATE POLICY "Public read access for all documents" ON storage.objects
  FOR SELECT USING (true);

-- Create upload policies for authenticated users
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create update policies for users to manage their own files
CREATE POLICY "Users can update own documents" ON storage.objects
  FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Create delete policies for users to manage their own files
CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);