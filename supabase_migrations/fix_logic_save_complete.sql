-- Complete fix for logic saving issues
-- Run this entire script at once in Supabase SQL Editor

-- 1. Drop existing functions if they exist
DROP FUNCTION IF EXISTS simple_update_base_logic CASCADE;
DROP FUNCTION IF EXISTS simple_update_study_logic CASCADE;

-- 2. Create simple base logic function
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
        'user_id', p_user_id,
        'saved_at', NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create simple study logic function
CREATE OR REPLACE FUNCTION simple_update_study_logic(
    p_user_id UUID,
    p_study_type TEXT,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_rows_updated INTEGER;
BEGIN
    -- Direct update
    UPDATE templates 
    SET 
        agent_logic_2 = p_logic,
        agent_logic_2_updated_at = NOW()
    WHERE user_id = p_user_id 
    AND study_type = p_study_type;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'rows_updated', v_rows_updated,
            'user_id', p_user_id,
            'study_type', p_study_type,
            'saved_at', NOW()
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Template not found',
            'user_id', p_user_id,
            'study_type', p_study_type
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION simple_update_base_logic TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_base_logic TO anon;
GRANT EXECUTE ON FUNCTION simple_update_study_logic TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_study_logic TO anon;

-- 5. Quick test to verify functions work
DO $$
DECLARE
    test_result JSONB;
BEGIN
    -- Test base logic function
    SELECT simple_update_base_logic(
        'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
        jsonb_build_object(
            'version', '3.0',
            'test', 'function_works',
            'timestamp', NOW()::text
        )
    ) INTO test_result;
    
    RAISE NOTICE 'Base logic function result: %', test_result;
    
    -- Test study logic function
    SELECT simple_update_study_logic(
        'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
        'MRI Hip',
        jsonb_build_object(
            'version', '1.0',
            'test', 'function_works',
            'timestamp', NOW()::text
        )
    ) INTO test_result;
    
    RAISE NOTICE 'Study logic function result: %', test_result;
END $$;

-- 6. Verify the data was saved
SELECT 
    'Base Logic Saved' as status,
    user_id,
    default_agent_logic->>'test' as test_value,
    default_agent_logic->>'timestamp' as saved_at,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

SELECT 
    'Study Logic Saved' as status,
    user_id,
    study_type,
    agent_logic_2->>'test' as test_value,
    agent_logic_2->>'timestamp' as saved_at,
    agent_logic_2_updated_at
FROM templates
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';

-- 7. Show function list to confirm they exist
SELECT 
    proname as function_name,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE proname IN ('simple_update_base_logic', 'simple_update_study_logic');