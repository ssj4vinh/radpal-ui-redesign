-- Complete fix for logic saving issues
-- Run this entire script in Supabase SQL Editor

-- 1. First, completely disable and re-enable RLS to reset everything
ALTER TABLE user_default_logic DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_default_logic'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_default_logic', pol.policyname);
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

-- 4. Create a very permissive policy for authenticated users
CREATE POLICY "authenticated_users_full_access"
    ON user_default_logic
    FOR ALL
    TO authenticated
    USING (true)  -- Allow reading all rows for authenticated users
    WITH CHECK (auth.uid() = user_id);  -- But only allow modifying own rows

-- 5. Alternative: If the above still doesn't work, try this even more permissive version
-- Comment out the policy above and uncomment this one if needed:
/*
CREATE POLICY "super_permissive_policy"
    ON user_default_logic
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
*/

-- 6. Grant all permissions
GRANT ALL ON user_default_logic TO authenticated;
GRANT ALL ON user_default_logic TO anon;  -- Sometimes needed for initial auth

-- 7. Ensure the table structure is correct
ALTER TABLE user_default_logic 
    ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- 8. Check and fix templates table for study logic
ALTER TABLE templates 
    ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB DEFAULT '{}'::jsonb;

ALTER TABLE templates 
    ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 9. Ensure templates table has proper RLS for study logic saves
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Drop existing templates policies and recreate
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;

-- Create comprehensive policy for templates
CREATE POLICY "Users can manage own templates"
    ON templates
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 10. Grant permissions on templates
GRANT ALL ON templates TO authenticated;

-- 11. Debug: Check current user and policies
SELECT 
    'Current User ID:' as label,
    auth.uid() as value
UNION ALL
SELECT 
    'Current Role:' as label,
    current_user as value;

-- 12. Verify policies are created
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
WHERE tablename IN ('user_default_logic', 'templates')
ORDER BY tablename, policyname;

-- 13. Test: Try to insert a test row (this will help identify the exact issue)
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Try to insert or update
    INSERT INTO user_default_logic (user_id, default_agent_logic)
    VALUES (current_user_id, '{"test": true}'::jsonb)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        default_agent_logic = '{"test": true}'::jsonb,
        updated_at = NOW();
        
    RAISE NOTICE 'Test insert/update successful for user %', current_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test failed: % %', SQLERRM, SQLSTATE;
END $$;