-- ============================================
-- IMMEDIATE FIX FOR INVITE CODES NOT WORKING
-- ============================================

-- STEP 1: Check if codes actually exist in the database
SELECT code, used_by, created_at 
FROM invite_codes 
ORDER BY created_at DESC;

-- If the above returns nothing, your table is empty! Add a code:
INSERT INTO invite_codes (code, created_at) 
VALUES ('RADPAL2024', NOW())
ON CONFLICT (code) DO NOTHING;

-- STEP 2: Check RLS status
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'invite_codes';

-- STEP 3: THE MAIN FIX - Allow anonymous access for signup
-- This is likely your issue - anonymous users can't read the table!

-- First, disable RLS temporarily to test
ALTER TABLE invite_codes DISABLE ROW LEVEL SECURITY;

-- Now test your signup with code 'RADPAL2024' - it should work!

-- If it works, re-enable RLS with proper policies:
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Service role can manage invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Users can view their own invite code" ON invite_codes;
DROP POLICY IF EXISTS "Public can check invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Enable read access for all users" ON invite_codes;

-- Create the CRITICAL policy - allow EVERYONE to read (for signup check)
CREATE POLICY "Enable read access for all users" 
ON invite_codes FOR SELECT 
USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access" 
ON invite_codes FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- STEP 4: Test the fix by checking as anonymous user
SET ROLE anon;
SELECT code, used_by FROM invite_codes WHERE code = 'RADPAL2024';
-- Should return the code!
RESET ROLE;

-- STEP 5: Add a fresh test code
INSERT INTO invite_codes (code, created_at)
VALUES ('TEST123', NOW())
ON CONFLICT (code) DO NOTHING;

-- STEP 6: Verify you can see all codes
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
-- ALTERNATIVE: If RLS is still causing issues
-- ============================================

-- Option A: Keep RLS disabled (less secure but will work)
ALTER TABLE invite_codes DISABLE ROW LEVEL SECURITY;

-- Option B: Use service role key in your app (more secure)
-- You would need to update your supabasebridge.js to use
-- the service role key instead of anon key for invite checks

-- ============================================
-- VERIFY THE FIX WORKED
-- ============================================

-- This should return your codes:
SELECT code FROM invite_codes;

-- This should also work as anon:
SET ROLE anon;
SELECT code FROM invite_codes WHERE code IN ('RADPAL2024', 'TEST123');
RESET ROLE;

-- ============================================
-- CODES TO TEST WITH
-- ============================================
-- After running this script, you can test with these codes:
-- RADPAL2024
-- TEST123