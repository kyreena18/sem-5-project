-- Fix RLS policy for notifications table to allow authenticated users to insert notifications

-- First, check if the policy already exists and drop it if it does
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;

-- Create the RLS policy to allow authenticated users to insert notifications
CREATE POLICY "Allow authenticated users to insert notifications"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'notifications' AND policyname = 'Allow authenticated users to insert notifications';