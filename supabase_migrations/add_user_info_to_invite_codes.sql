-- ============================================
-- Add User Information Columns to invite_codes Table
-- ============================================
-- This migration adds email, first_name, and last_name columns
-- to track who used each invite code
-- ============================================

-- 1. Add new columns to invite_codes table
ALTER TABLE invite_codes 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;

-- 2. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_email 
ON invite_codes(email);

CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by 
ON invite_codes(used_by);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code 
ON invite_codes(code);

-- 3. Add column comments for documentation
COMMENT ON COLUMN invite_codes.email IS 'Email address of the user who used this code';
COMMENT ON COLUMN invite_codes.first_name IS 'First name of the user who used this code';
COMMENT ON COLUMN invite_codes.last_name IS 'Last name of the user who used this code';
COMMENT ON COLUMN invite_codes.used_at IS 'Timestamp when the code was used';

-- 4. Update existing used codes with user information (if available)
-- This will backfill data for codes that were already used
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

-- 5. Create or update RLS policies for invite_codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Service role can manage invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view their own invite code" ON invite_codes;

-- Policy: Service role can do everything
CREATE POLICY "Service role can manage invite codes"
ON invite_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can view the code they used
CREATE POLICY "Users can view their own invite code"
ON invite_codes 
FOR SELECT
TO authenticated
USING (auth.uid() = used_by);

-- 6. Create a view for easy invite code reporting
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

-- Grant permissions on the view
GRANT SELECT ON invite_codes_usage TO authenticated;
GRANT SELECT ON invite_codes_usage TO service_role;

-- ============================================
-- Verification Queries
-- ============================================
/*
-- Check the updated table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'invite_codes'
ORDER BY ordinal_position;

-- View usage statistics
SELECT 
    status,
    COUNT(*) as count,
    AVG(hours_to_use) as avg_hours_to_use
FROM invite_codes_usage
GROUP BY status;

-- See recent invite code usage
SELECT * FROM invite_codes_usage 
WHERE used_at IS NOT NULL
ORDER BY used_at DESC
LIMIT 10;
*/

-- ============================================
-- Rollback Commands (if needed)
-- ============================================
/*
-- Remove the new columns
ALTER TABLE invite_codes 
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS used_at;

-- Drop the indexes
DROP INDEX IF EXISTS idx_invite_codes_email;
DROP INDEX IF EXISTS idx_invite_codes_used_by;
DROP INDEX IF EXISTS idx_invite_codes_code;

-- Drop the view
DROP VIEW IF EXISTS invite_codes_usage;
*/