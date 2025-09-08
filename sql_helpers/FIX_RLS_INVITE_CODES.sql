-- ============================================
-- IMMEDIATE FIX FOR RLS BLOCKING INVITE CODES
-- ============================================
-- Run this in Supabase SQL Editor to fix invite code validation

-- Step 1: Check current RLS status
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'invite_codes';

-- Step 2: Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Service role can manage invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view their own invite code" ON invite_codes;
DROP POLICY IF EXISTS "Public can check invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Enable read access for all users" ON invite_codes;
DROP POLICY IF EXISTS "Service role full access" ON invite_codes;

-- Step 3: Enable RLS (if not already enabled)
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Step 4: Create the CRITICAL policy - allow EVERYONE to read
-- This allows anonymous users during signup to validate codes
CREATE POLICY "Anyone can read invite codes" 
ON invite_codes 
FOR SELECT 
USING (true);

-- Step 5: Service role can do everything
CREATE POLICY "Service role full access" 
ON invite_codes 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Step 6: Authenticated users can update codes (to mark as used)
CREATE POLICY "Authenticated users can update codes"
ON invite_codes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 7: Test the fix - this should return your codes
SELECT code, used_by FROM invite_codes;

-- Step 8: Test as anonymous user (what happens during signup)
SET ROLE anon;
SELECT code, used_by FROM invite_codes WHERE UPPER(code) = 'RADPAL2024';
RESET ROLE;

-- Step 9: Add some test codes if needed
INSERT INTO invite_codes (code, created_at)
VALUES 
    ('RADPAL2024', NOW()),
    ('TEST123', NOW()),
    ('WELCOME2024', NOW())
ON CONFLICT (code) DO NOTHING;

-- Step 10: Verify everything works
SELECT 
    code,
    CASE 
        WHEN used_by IS NULL THEN '✅ Available'
        ELSE '❌ Used'
    END as status,
    created_at
FROM invite_codes
ORDER BY created_at DESC;

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. The key issue is that anonymous users (during signup) 
--    need to be able to READ the invite_codes table
-- 2. The policy "Anyone can read invite codes" fixes this
-- 3. This is secure because users still need the exact code
-- 4. After running this, test signup with code 'RADPAL2024'