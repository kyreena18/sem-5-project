/*
  # Add offer_letter_url column to placement_applications table

  1. Changes
    - Add `offer_letter_url` column to `placement_applications` table
    - Column allows storing URLs of uploaded offer letters
    - Column is optional (nullable) as not all applications will have offer letters

  2. Security
    - No RLS changes needed as existing policies cover the new column
*/

-- Add offer_letter_url column to placement_applications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'placement_applications' AND column_name = 'offer_letter_url'
  ) THEN
    ALTER TABLE placement_applications ADD COLUMN offer_letter_url TEXT;
  END IF;
END $$;