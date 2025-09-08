-- Test direct database operations to diagnose save issues

-- 1. First, check if user_default_logic table has RLS enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_default_logic';

-- 2. Check current RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_default_logic';

-- 3. TEMPORARILY disable RLS to test if that's the issue
ALTER TABLE user_default_logic DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;

-- 4. Test direct INSERT/UPDATE without RLS
-- First delete any existing row
DELETE FROM user_default_logic 
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

-- Then insert a test row
INSERT INTO user_default_logic (
    user_id, 
    default_agent_logic, 
    created_at, 
    updated_at
)
VALUES (
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    jsonb_build_object(
        'version', '3.0',
        'test', 'direct_insert_no_rls',
        'timestamp', NOW()::text,
        'general', jsonb_build_object(
            'tone', jsonb_build_object(
                'style', 'balanced'
            ),
            'corrections', jsonb_build_object(
                'rules', '[]'::jsonb
            )
        )
    ),
    NOW(),
    NOW()
);

-- 5. Verify the insert worked
SELECT 
    'Direct Insert Result' as operation,
    user_id,
    default_agent_logic->>'test' as test_value,
    pg_column_size(default_agent_logic) as size_bytes,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

-- 6. Test updating templates directly
UPDATE templates 
SET 
    agent_logic_2 = jsonb_build_object(
        'version', '1.0',
        'test', 'direct_update_no_rls',
        'timestamp', NOW()::text,
        'study_report', jsonb_build_object(
            'anatomic_routing_rules', '[]'::jsonb,
            'custom_rules', '[]'::jsonb
        )
    ),
    agent_logic_2_updated_at = NOW()
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';

-- 7. Verify the update worked
SELECT 
    'Direct Update Result' as operation,
    study_type,
    agent_logic_2->>'test' as test_value,
    pg_column_size(agent_logic_2) as size_bytes,
    agent_logic_2_updated_at
FROM templates
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';

-- 8. IMPORTANT: Re-enable RLS after testing
-- Run this separately after confirming the above works
-- ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE templates ENABLE ROW LEVEL SECURITY;