-- Enhanced database functions with logging to debug persistence issues

-- Drop existing functions
DROP FUNCTION IF EXISTS upsert_user_default_logic CASCADE;
DROP FUNCTION IF EXISTS update_template_agent_logic_2 CASCADE;

-- 1. Enhanced function for base logic with logging
CREATE OR REPLACE FUNCTION upsert_user_default_logic(
    p_user_id UUID,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_existing_id UUID;
BEGIN
    -- Log the input
    RAISE NOTICE 'upsert_user_default_logic called with user_id: %, logic keys: %', 
        p_user_id, 
        array_to_string(array(SELECT jsonb_object_keys(p_logic)), ', ');
    
    -- Check if a row exists
    SELECT id INTO v_existing_id
    FROM user_default_logic
    WHERE user_id = p_user_id;
    
    IF v_existing_id IS NOT NULL THEN
        -- Update existing row
        RAISE NOTICE 'Updating existing row for user_id: %', p_user_id;
        
        UPDATE user_default_logic
        SET 
            default_agent_logic = p_logic,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING jsonb_build_object(
            'success', true,
            'action', 'updated',
            'user_id', user_id,
            'updated_at', updated_at,
            'logic_size', pg_column_size(default_agent_logic)
        ) INTO v_result;
    ELSE
        -- Insert new row
        RAISE NOTICE 'Inserting new row for user_id: %', p_user_id;
        
        INSERT INTO user_default_logic (user_id, default_agent_logic, created_at, updated_at)
        VALUES (p_user_id, p_logic, NOW(), NOW())
        RETURNING jsonb_build_object(
            'success', true,
            'action', 'inserted',
            'user_id', user_id,
            'created_at', created_at,
            'logic_size', pg_column_size(default_agent_logic)
        ) INTO v_result;
    END IF;
    
    RAISE NOTICE 'Operation result: %', v_result;
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in upsert_user_default_logic: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION upsert_user_default_logic TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_default_logic TO anon;

-- 2. Enhanced function for study logic with logging
CREATE OR REPLACE FUNCTION update_template_agent_logic_2(
    p_user_id UUID,
    p_study_type TEXT,
    p_logic JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_rows_updated INTEGER;
BEGIN
    -- Log the input
    RAISE NOTICE 'update_template_agent_logic_2 called with user_id: %, study_type: %, logic keys: %', 
        p_user_id, 
        p_study_type,
        array_to_string(array(SELECT jsonb_object_keys(p_logic)), ', ');
    
    -- Update the template
    UPDATE templates 
    SET 
        agent_logic_2 = p_logic,
        agent_logic_2_updated_at = NOW()
    WHERE user_id = p_user_id 
    AND study_type = p_study_type;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated > 0 THEN
        -- Get the updated data
        SELECT jsonb_build_object(
            'success', true,
            'user_id', user_id,
            'study_type', study_type,
            'updated_at', agent_logic_2_updated_at,
            'rows_updated', v_rows_updated,
            'logic_size', pg_column_size(agent_logic_2)
        ) INTO v_result
        FROM templates
        WHERE user_id = p_user_id 
        AND study_type = p_study_type;
        
        RAISE NOTICE 'Successfully updated % rows for study_type: %', v_rows_updated, p_study_type;
    ELSE
        RAISE NOTICE 'No rows found to update for user_id: %, study_type: %', p_user_id, p_study_type;
        v_result := jsonb_build_object(
            'success', false, 
            'error', format('Template not found for user %s and study type %s', p_user_id, p_study_type),
            'rows_updated', 0
        );
    END IF;
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in update_template_agent_logic_2: % %', SQLERRM, SQLSTATE;
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'sqlstate', SQLSTATE
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_template_agent_logic_2 TO authenticated;
GRANT EXECUTE ON FUNCTION update_template_agent_logic_2 TO anon;

-- 3. Test the functions with your user ID
-- These should show detailed logging in the Supabase logs
SELECT upsert_user_default_logic(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    '{"version": "3.0", "test": "base_logic_test_with_logging"}'::JSONB
);

SELECT update_template_agent_logic_2(
    'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID,
    'MRI Hip',
    '{"version": "1.0", "test": "study_logic_test_with_logging"}'::JSONB
);

-- 4. Verify the data was saved
SELECT 
    'Base Logic' as type,
    user_id,
    jsonb_pretty(default_agent_logic) as logic,
    updated_at
FROM user_default_logic
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID;

SELECT 
    'Study Logic' as type,
    user_id,
    study_type,
    jsonb_pretty(agent_logic_2) as logic,
    agent_logic_2_updated_at as updated_at
FROM templates
WHERE user_id = 'f9734fe3-2cd1-47e3-8e89-dcbd72ce6f8b'::UUID
AND study_type = 'MRI Hip';