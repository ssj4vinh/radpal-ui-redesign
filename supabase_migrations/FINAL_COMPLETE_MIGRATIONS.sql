-- ============================================
-- COMPLETE SQL MIGRATIONS FOR ALL RECENT CHANGES
-- ============================================
-- Run these commands in your Supabase SQL Editor
-- These include all the user profile and invite code updates
-- ============================================

-- ============================================
-- PART 1: USER PROFILE COLUMNS IN user_subscriptions
-- ============================================

-- Add user profile columns to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add timestamps if they don't exist
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email 
ON user_subscriptions(email);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
ON user_subscriptions(user_id);

-- Add column comments
COMMENT ON COLUMN user_subscriptions.first_name IS 'User''s first name';
COMMENT ON COLUMN user_subscriptions.last_name IS 'User''s last name';
COMMENT ON COLUMN user_subscriptions.email IS 'User''s email address';
COMMENT ON COLUMN user_subscriptions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN user_subscriptions.updated_at IS 'Timestamp when the record was last updated';

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS and create policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;

CREATE POLICY "Users can view own subscription"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
ON user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
ON user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Backfill email data from auth.users for existing records
UPDATE user_subscriptions us
SET email = u.email,
    updated_at = NOW()
FROM auth.users u
WHERE us.user_id = u.id
  AND us.email IS NULL
  AND u.email IS NOT NULL;

-- ============================================
-- PART 2: USER PROFILES VIEW
-- ============================================

-- Drop existing view if exists (it's a view, not a table)
DROP VIEW IF EXISTS user_profiles CASCADE;

-- Create user profiles view
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

-- Grant permissions
GRANT SELECT ON user_profiles TO authenticated;

-- ============================================
-- PART 3: LOGIC EDITOR V3 SUPPORT
-- ============================================

-- Add agent_logic_2 column to templates table
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB,
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN templates.agent_logic_2 IS 'Study-specific logic configuration (v3 schema)';
COMMENT ON COLUMN templates.agent_logic_2_updated_at IS 'Last update timestamp for agent_logic_2';

-- Create user_default_logic table for base logic
CREATE TABLE IF NOT EXISTS user_default_logic (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_agent_logic JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_default_logic_user_id 
ON user_default_logic(user_id);

-- Enable RLS
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

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

COMMENT ON TABLE user_default_logic IS 'Stores base agent logic configuration per user';
COMMENT ON COLUMN user_default_logic.default_agent_logic IS 'Base logic configuration (v3 schema)';

-- ============================================
-- PART 4: INVITE CODES USER TRACKING
-- ============================================

-- Add user info columns to invite_codes table
ALTER TABLE invite_codes 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for invite_codes
CREATE INDEX IF NOT EXISTS idx_invite_codes_email 
ON invite_codes(email);

CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by 
ON invite_codes(used_by);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code 
ON invite_codes(code);

-- Add comments
COMMENT ON COLUMN invite_codes.email IS 'Email address of the user who used this code';
COMMENT ON COLUMN invite_codes.first_name IS 'First name of the user who used this code';
COMMENT ON COLUMN invite_codes.last_name IS 'Last name of the user who used this code';
COMMENT ON COLUMN invite_codes.used_at IS 'Timestamp when the code was used';

-- Backfill invite codes with user data if available
UPDATE invite_codes ic
SET 
    email = us.email,
    first_name = us.first_name,
    last_name = us.last_name,
    used_at = COALESCE(ic.used_at, us.created_at, NOW())
FROM user_subscriptions us
WHERE ic.used_by = us.user_id
  AND ic.used_by IS NOT NULL
  AND ic.email IS NULL;

-- Enable RLS for invite_codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view their own invite code" ON invite_codes;

CREATE POLICY "Service role can manage invite codes"
ON invite_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own invite code"
ON invite_codes 
FOR SELECT
TO authenticated
USING (auth.uid() = used_by);

-- Create invite codes usage view for reporting
CREATE OR REPLACE VIEW invite_codes_usage AS
SELECT 
    ic.code,
    ic.used_by,
    ic.email,
    ic.first_name,
    ic.last_name,
    ic.created_at as code_created_at,
    ic.used_at,
    u.email as auth_email,
    u.created_at as user_created_at,
    us.tier as user_tier,
    CASE 
        WHEN ic.used_by IS NULL THEN 'Available'
        ELSE 'Used'
    END as status,
    CASE 
        WHEN ic.used_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ic.used_at - ic.created_at)) / 3600
        ELSE NULL
    END as hours_to_use
FROM invite_codes ic
LEFT JOIN auth.users u ON ic.used_by = u.id
LEFT JOIN user_subscriptions us ON ic.used_by = us.user_id
ORDER BY ic.created_at DESC;

-- Grant permissions
GRANT SELECT ON invite_codes_usage TO authenticated;
GRANT SELECT ON invite_codes_usage TO service_role;

-- ============================================
-- VERIFICATION QUERIES - Run these to check everything
-- ============================================

-- Check user_subscriptions structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
ORDER BY ordinal_position;

-- Check invite_codes structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_codes'
ORDER BY ordinal_position;

-- Check templates structure for agent_logic_2
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'templates' 
  AND column_name IN ('agent_logic_2', 'agent_logic_2_updated_at');

-- Check user_default_logic exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'user_default_logic'
) as table_exists;

-- Check all policies are in place
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('user_subscriptions', 'user_default_logic', 'invite_codes')
ORDER BY tablename, policyname;

-- View recent signups with invite codes
SELECT * FROM invite_codes_usage 
WHERE used_at IS NOT NULL
ORDER BY used_at DESC
LIMIT 10;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If all queries above run without errors, your database is fully updated!
-- The application will now:
-- 1. Store user profiles (first_name, last_name, email) during signup
-- 2. Track who used which invite code with their details
-- 3. Support the new Logic Editor V3 with separate base/study logic
-- 4. Auto-sync emails when users log in