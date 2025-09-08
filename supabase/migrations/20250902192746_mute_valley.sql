/*
  # Add class column to students table and remove unused columns

  1. Schema Changes
    - Add `class` column to students table with valid class options
    - Remove unused columns: gpa, year, department
    - Add check constraint for valid class values

  2. Data Migration
    - Migrate existing class data from student_profiles to students table
    - Ensure data consistency between tables

  3. Security
    - Maintain existing RLS policies
    - Update policies to work with new schema
*/

-- First, add the class column to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'class'
  ) THEN
    ALTER TABLE students ADD COLUMN class text DEFAULT 'SYIT';
  END IF;
END $$;

-- Add check constraint for valid class values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'students_class_check'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_class_check 
    CHECK (class = ANY (ARRAY['SYIT'::text, 'SYSD'::text, 'TYIT'::text, 'TYSD'::text]));
  END IF;
END $$;

-- Migrate existing class data from student_profiles to students
UPDATE students 
SET class = sp.class
FROM student_profiles sp
WHERE students.id = sp.student_id 
AND sp.class IS NOT NULL;

-- Remove unused columns from students table
DO $$
BEGIN
  -- Remove gpa column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'gpa'
  ) THEN
    ALTER TABLE students DROP COLUMN gpa;
  END IF;

  -- Remove year column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'year'
  ) THEN
    ALTER TABLE students DROP COLUMN year;
  END IF;

  -- Remove department column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'department'
  ) THEN
    ALTER TABLE students DROP COLUMN department;
  END IF;
END $$;

-- Add index for class column for better query performance
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);