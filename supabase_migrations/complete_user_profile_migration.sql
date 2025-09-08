-- ============================================
-- Complete SQL Migration for User Profile System
-- ============================================
-- This file contains all SQL commands needed to implement
-- the user profile changes in your Supabase database
-- 
-- Run these commands in order in your Supabase SQL Editor
-- ============================================

-- 1. Add user profile columns to user_subscriptions table
-- ============================================
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add created_at and updated_at columns if they don't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create index for faster email lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email 
ON user_subscriptions(email);

-- Create index on user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
ON user_subscriptions(user_id);

-- 3. Add column comments for documentation
-- ============================================
COMMENT ON COLUMN user_subscriptions.first_name IS 'User''s first name';
COMMENT ON COLUMN user_subscriptions.last_name IS 'User''s last name';
COMMENT ON COLUMN user_subscriptions.email IS 'User''s email address';
COMMENT ON COLUMN user_subscriptions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN user_subscriptions.updated_at IS 'Timestamp when the record was last updated';

-- 4. Create or replace function to automatically update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-update updated_at on row changes
-- ============================================
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Ensure RLS (Row Level Security) policies if needed
-- ============================================
-- Enable RLS on the table (if not already enabled)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;

-- Policy: Users can view their own subscription data
CREATE POLICY "Users can view own subscription"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can update their own subscription data
CREATE POLICY "Users can update own subscription"
ON user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can insert their own subscription data
CREATE POLICY "Users can insert own subscription"
ON user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 7. Backfill email data for existing users (optional)
-- ============================================
-- This will sync email addresses from auth.users to user_subscriptions
-- for any existing records that don't have an email
UPDATE user_subscriptions us
SET email = u.email,
    updated_at = NOW()
FROM auth.users u
WHERE us.user_id = u.id
  AND us.email IS NULL
  AND u.email IS NOT NULL;

-- 8. Create view for easy user profile access (optional but helpful)
-- ============================================
-- First check if user_profiles exists as a table and drop it if needed
DROP TABLE IF EXISTS user_profiles CASCADE;
-- Also drop if it exists as a view (just to be safe)
DROP VIEW IF EXISTS user_profiles CASCADE;

-- Now create the view
CREATE VIEW user_profiles AS
SELECT 
    us.user_id,
    us.tier,
    us.first_name,
    us.last_name,
    us.email,
    us.created_at,
    us.updated_at,
    u.email as auth_email,
    u.created_at as user_created_at,
    u.last_sign_in_at
FROM user_subscriptions us
LEFT JOIN auth.users u ON us.user_id = u.id;

-- Grant permissions on the view
GRANT SELECT ON user_profiles TO authenticated;

-- 9. Add agent_logic_2 column to templates table (for logic editor v3)
-- ============================================
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB,
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN templates.agent_logic_2 IS 'Study-specific logic configuration (v3 schema)';
COMMENT ON COLUMN templates.agent_logic_2_updated_at IS 'Last update timestamp for agent_logic_2';

-- 10. Create user_default_logic table for base logic storage
-- ============================================
CREATE TABLE IF NOT EXISTS user_default_logic (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_agent_logic JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_default_logic_user_id 
ON user_default_logic(user_id);

-- Enable RLS
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_default_logic
DROP POLICY IF EXISTS "Users can view own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can update own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can insert own default logic" ON user_default_logic;

CREATE POLICY "Users can view own default logic"
ON user_default_logic FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own default logic"
ON user_default_logic FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own default logic"
ON user_default_logic FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_user_default_logic_updated_at ON user_default_logic;

CREATE TRIGGER update_user_default_logic_updated_at
BEFORE UPDATE ON user_default_logic
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_default_logic IS 'Stores base agent logic configuration per user';
COMMENT ON COLUMN user_default_logic.default_agent_logic IS 'Base logic configuration (v3 schema)';

-- ============================================
-- Verification Queries (Run these to check everything worked)
-- ============================================

-- Check user_subscriptions table structure
/*
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
ORDER BY ordinal_position;
*/

-- Check if indexes were created
/*
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'user_subscriptions';
*/

-- Check RLS policies
/*
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
WHERE tablename IN ('user_subscriptions', 'user_default_logic');
*/

-- Check user_default_logic table structure
/*
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_default_logic'
ORDER BY ordinal_position;
*/

-- Check templates table for agent_logic_2 column
/*
SELECT 
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_name = 'templates' 
  AND column_name IN ('agent_logic_2', 'agent_logic_2_updated_at');
*/

-- ============================================
-- Rollback Commands (Only if needed)
-- ============================================
/*
-- To rollback user_subscriptions changes:
ALTER TABLE user_subscriptions 
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS email;

DROP INDEX IF EXISTS idx_user_subscriptions_email;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

-- To rollback templates changes:
ALTER TABLE templates
DROP COLUMN IF EXISTS agent_logic_2,
DROP COLUMN IF EXISTS agent_logic_2_updated_at;

-- To rollback user_default_logic table:
DROP TABLE IF EXISTS user_default_logic CASCADE;

-- To rollback the view:
DROP VIEW IF EXISTS user_profiles;
*/