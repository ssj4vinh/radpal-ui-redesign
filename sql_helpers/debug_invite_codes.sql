-- ============================================
-- DEBUG INVITE CODES ISSUES
-- ============================================

-- 1. First, check if your invite codes exist and their status
SELECT 
    code,
    used_by,
    email,
    first_name,
    last_name,
    used_at,
    created_at,
    CASE 
        WHEN used_by IS NULL THEN '✅ Available'
        ELSE '❌ Already Used'
    END as status
FROM invite_codes
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check specifically for the code you're trying to use
-- Replace 'YOUR_CODE_HERE' with the actual code you're testing
SELECT 
    code,
    used_by,
    email,
    created_at,
    used_at,
    CASE 
        WHEN used_by IS NULL THEN '✅ Available for use'
        ELSE '❌ Already used by: ' || COALESCE(email, used_by::text)
    END as status
FROM invite_codes
WHERE code = 'RADPAL2024';  -- Change this to your test code

-- 3. Check RLS policies on invite_codes table
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
WHERE tablename = 'invite_codes';

-- 4. Check if RLS is enabled
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class
WHERE relname = 'invite_codes';

-- 5. Test query as anon role (what the app uses before login)
-- This simulates what happens when the app checks the code
SET ROLE anon;
SELECT code, used_by FROM invite_codes WHERE code = 'RADPAL2024';
RESET ROLE;

-- 6. POTENTIAL FIX: If RLS is blocking anon access, create this policy
-- This allows anonymous users (during signup) to check if codes are valid
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;

CREATE POLICY "Anyone can check invite codes"
ON invite_codes
FOR SELECT
TO anon, authenticated
USING (true);

-- 7. Alternative: Temporarily disable RLS for testing
-- WARNING: Only use this for debugging, re-enable after!
-- ALTER TABLE invite_codes DISABLE ROW LEVEL SECURITY;

-- To re-enable:
-- ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- 8. Create a fresh test code and verify it works
INSERT INTO invite_codes (code, created_at)
VALUES ('TEST' || to_char(NOW(), 'MMDD'), NOW())
RETURNING code, created_at;

-- 9. Verify the test code is accessible
SELECT 
    code,
    used_by,
    CASE 
        WHEN used_by IS NULL THEN '✅ Ready to use'
        ELSE '❌ Already used'
    END as status
FROM invite_codes
WHERE code LIKE 'TEST%'
ORDER BY created_at DESC
LIMIT 1;

-- 10. Check if there are any constraints that might be blocking
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'invite_codes'::regclass;

-- ============================================
-- MOST LIKELY FIX: Add anon access policy
-- ============================================
-- Run this to allow signup process to check codes:

-- Allow anyone to read invite codes (they still need the exact code)
DROP POLICY IF EXISTS "Public can check invite codes" ON invite_codes;

CREATE POLICY "Public can check invite codes"
ON invite_codes
FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'invite_codes';

-- ============================================
-- TEST YOUR CODE AGAIN AFTER RUNNING THE FIX
-- ============================================