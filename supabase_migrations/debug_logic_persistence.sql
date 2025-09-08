-- Debug script to identify why logic changes aren't persisting

-- 1. First, check if the functions exist
SELECT 
    proname as function_name,
    prosecdef as security_definer
FROM pg_proc 
WHERE proname IN ('upsert_user_default_logic', 'update_template_agent_logic_2');

-- 2. Check current data for your user
SELECT 
    'Current Base Logic' as check_type,
    user_id,
    pg_column_size(default_agent_logic) as size_bytes,
    jsonb_pretty(default_agent_logic) as logic_content,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

SELECT 
    'Current Study Logic' as check_type,
    user_id,
    study_type,
    pg_column_size(agent_logic_2) as size_bytes,
    jsonb_pretty(agent_logic_2) as logic_content,
    agent_logic_2_updated_at as updated_at
FROM templates
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';

-- 3. Test direct UPDATE (bypassing functions) to see if it works
-- Test updating base logic directly
UPDATE user_default_logic
SET 
    default_agent_logic = jsonb_build_object(
        'version', '3.0',
        'test', 'direct_update_test',
        'timestamp', NOW()::text
    ),
    updated_at = NOW()
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

-- Check if it worked
SELECT 
    'After Direct Update' as status,
    default_agent_logic->>'test' as test_value,
    default_agent_logic->>'timestamp' as timestamp,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

-- 4. Test the function with simple data
SELECT upsert_user_default_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    jsonb_build_object(
        'version', '3.0',
        'test', 'function_test',
        'timestamp', NOW()::text
    )
) as function_result;

-- Check if function update worked
SELECT 
    'After Function Update' as status,
    default_agent_logic->>'test' as test_value,
    default_agent_logic->>'timestamp' as timestamp,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

-- 5. Check if there are any triggers that might be interfering
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('user_default_logic', 'templates');

-- 6. Check table permissions
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('user_default_logic', 'templates')
AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

-- 7. Create a simpler function that definitely works
CREATE OR REPLACE FUNCTION simple_update_base_logic(
    p_user_id UUID,
    p_logic JSONB
)
RETURNS JSONB AS $$
BEGIN
    -- Delete existing row if any
    DELETE FROM user_default_logic WHERE user_id = p_user_id;
    
    -- Insert new row
    INSERT INTO user_default_logic (user_id, default_agent_logic, created_at, updated_at)
    VALUES (p_user_id, p_logic, NOW(), NOW());
    
    RETURN jsonb_build_object(
        'success', true,
        'action', 'replaced',
        'user_id', p_user_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION simple_update_base_logic TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_base_logic TO anon;

-- Test the simple function
SELECT simple_update_base_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    jsonb_build_object(
        'version', '3.0',
        'test', 'simple_function_test',
        'timestamp', NOW()::text
    )
) as result;

-- Verify it worked
SELECT 
    'After Simple Function' as status,
    default_agent_logic->>'test' as test_value,
    default_agent_logic->>'timestamp' as timestamp,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;