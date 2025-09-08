-- Fix RLS policies for user_default_logic table

-- First, check if the table exists
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can insert their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can update their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can delete their own default logic" ON user_default_logic;

-- Create new policies
-- Policy for SELECT
CREATE POLICY "Users can view their own default logic"
    ON user_default_logic
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy for INSERT
CREATE POLICY "Users can insert their own default logic"
    ON user_default_logic
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE
CREATE POLICY "Users can update their own default logic"
    ON user_default_logic
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for DELETE
CREATE POLICY "Users can delete their own default logic"
    ON user_default_logic
    FOR DELETE
    USING (auth.uid() = user_id);

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

-- Grant necessary permissions
GRANT ALL ON user_default_logic TO authenticated;

-- Grant sequence usage if it exists (handle the error gracefully)
DO $$
BEGIN
    -- Try to grant usage on the sequence if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_class 
        WHERE relname = 'user_default_logic_id_seq' 
        AND relkind = 'S'
    ) THEN
        EXECUTE 'GRANT USAGE ON SEQUENCE user_default_logic_id_seq TO authenticated';
    END IF;
END;
$$;

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