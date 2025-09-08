/*
  # Remove unique constraint on roll_no

  1. Schema Changes
    - Remove unique constraint on roll_no column in students table
    - Keep unique constraint on uid (which should remain unique)
    - Keep unique constraint on email (which should remain unique)
  
  2. Reasoning
    - Multiple students can have same roll number in different classes
    - UID remains unique identifier for each student
    - Email remains unique for login purposes
*/

-- Remove the unique constraint on roll_no
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'students_roll_no_key' 
    AND table_name = 'students'
  ) THEN
    ALTER TABLE students DROP CONSTRAINT students_roll_no_key;
  END IF;
END $$;

-- Remove the index on roll_no if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'students_roll_no_key'
  ) THEN
    DROP INDEX IF EXISTS students_roll_no_key;
  END IF;
END $$;

-- Create a regular (non-unique) index on roll_no for performance
CREATE INDEX IF NOT EXISTS idx_students_roll_no_non_unique ON students (roll_no);

-- Ensure UID and email remain unique (they should already be unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'students_uid_key' 
    AND table_name = 'students'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_uid_key UNIQUE (uid);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'students_email_key' 
    AND table_name = 'students'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_email_key UNIQUE (email);
  END IF;
END $$;