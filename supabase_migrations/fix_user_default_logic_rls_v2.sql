-- Fix RLS policies for user_default_logic table
-- This script ensures users can properly insert and update their own logic

-- First, check if the table exists and create it if not
CREATE TABLE IF NOT EXISTS user_default_logic (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_agent_logic JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can insert their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can update their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can delete their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON user_default_logic;

-- Create a single comprehensive policy for all operations
-- This approach is more reliable for UPSERT operations
CREATE POLICY "Enable all access for users based on user_id"
    ON user_default_logic
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_default_logic_user_id ON user_default_logic(user_id);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_default_logic_updated_at ON user_default_logic;

CREATE TRIGGER update_user_default_logic_updated_at
    BEFORE UPDATE ON user_default_logic
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to authenticated users
GRANT ALL ON user_default_logic TO authenticated;
-- No sequence to grant since we use UUID with gen_random_uuid()

-- Also ensure the templates table has proper columns for agent_logic_2
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB DEFAULT '{}'::jsonb;

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_default_logic'
ORDER BY policyname;

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_default_logic'
ORDER BY ordinal_position;

-- Check if any users have existing records
SELECT COUNT(*) as existing_records FROM user_default_logic;