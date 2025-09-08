-- Debug and Fix RLS Issues for Logic Saving
-- Run each section separately to identify the issue

-- SECTION 1: Check current authentication context
SELECT 
    'Current auth.uid():' as check_type,
    auth.uid()::text as value
UNION ALL
SELECT 
    'Current auth.role():' as check_type,
    auth.role()::text as value;

-- SECTION 2: Check if user_default_logic table exists and has data
SELECT 
    'Table exists:' as check_type,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_default_logic'
    )::text as value
UNION ALL
SELECT 
    'Row count:' as check_type,
    COUNT(*)::text as value
FROM user_default_logic;

-- SECTION 3: Check current policies
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_default_logic';

-- SECTION 4: NUCLEAR OPTION - Temporarily disable RLS (for testing only!)
-- WARNING: Only use this to test if RLS is the issue
-- Run this, test saving, then re-enable immediately
ALTER TABLE user_default_logic DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;

-- After testing, RE-ENABLE with:
-- ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- SECTION 5: Alternative fix - Create service role function
-- This bypasses RLS by using a function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION upsert_user_default_logic(
    p_user_id UUID,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    INSERT INTO user_default_logic (user_id, default_agent_logic, created_at, updated_at)
    VALUES (p_user_id, p_logic, NOW(), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        default_agent_logic = p_logic,
        updated_at = NOW()
    RETURNING jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'updated_at', updated_at
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_user_default_logic TO authenticated;

-- SECTION 6: Create similar function for templates/study logic
CREATE OR REPLACE FUNCTION update_template_agent_logic_2(
    p_user_id UUID,
    p_study_type TEXT,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE templates 
    SET 
        agent_logic_2 = p_logic,
        agent_logic_2_updated_at = NOW()
    WHERE user_id = p_user_id 
    AND study_type = p_study_type
    RETURNING jsonb_build_object(
        'success', true,
        'user_id', user_id,
        'study_type', study_type,
        'updated_at', agent_logic_2_updated_at
    ) INTO v_result;
    
    IF v_result IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Template not found');
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_template_agent_logic_2 TO authenticated;

-- SECTION 7: Test the functions
-- Replace 'YOUR_USER_ID' with your actual user ID from the console logs
-- You can find it in the error message: "Loading logic for user: f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b"
SELECT upsert_user_default_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    '{"test": "base_logic_test"}'::JSONB
);

SELECT update_template_agent_logic_2(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    'MRI Hip',
    '{"test": "study_logic_test"}'::JSONB
);