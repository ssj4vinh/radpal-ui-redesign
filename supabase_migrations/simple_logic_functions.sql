-- Simple, reliable functions for saving logic that bypass RLS

-- 1. Simple function for base logic (delete and insert)
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

-- 2. Simple function for study logic
CREATE OR REPLACE FUNCTION simple_update_study_logic(
    p_user_id UUID,
    p_study_type TEXT,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_rows_updated INTEGER;
BEGIN
    -- Direct update without any complex logic
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
        -- Try to provide helpful error info
        IF NOT EXISTS (SELECT 1 FROM templates WHERE user_id = p_user_id AND study_type = p_study_type) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Template not found',
                'user_id', p_user_id,
                'study_type', p_study_type
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Update failed for unknown reason',
                'rows_updated', 0
            );
        END IF;
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION simple_update_base_logic TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_base_logic TO anon;
GRANT EXECUTE ON FUNCTION simple_update_study_logic TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_study_logic TO anon;

-- 3. Test the functions
-- Test base logic
SELECT simple_update_base_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    jsonb_build_object(
        'version', '3.0',
        'test', 'simple_base_test',
        'timestamp', NOW()::text,
        'general', jsonb_build_object(
            'tone', jsonb_build_object('style', 'balanced')
        )
    )
) as base_result;

-- Test study logic
SELECT simple_update_study_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    'MRI Hip',
    jsonb_build_object(
        'version', '1.0',
        'test', 'simple_study_test',
        'timestamp', NOW()::text,
        'study_report', jsonb_build_object(
            'custom_rules', '[]'::jsonb
        )
    )
) as study_result;

-- 4. Verify the saves worked
SELECT 
    'Base Logic After Test' as check_type,
    default_agent_logic->>'test' as test_value,
    default_agent_logic->>'timestamp' as timestamp,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

SELECT 
    'Study Logic After Test' as check_type,
    agent_logic_2->>'test' as test_value,
    agent_logic_2->>'timestamp' as timestamp,
    agent_logic_2_updated_at as updated_at
FROM templates
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';