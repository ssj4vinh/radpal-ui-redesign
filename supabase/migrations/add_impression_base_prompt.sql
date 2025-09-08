-- Add impression_base_prompt column to the global_base_prompt table
-- This allows storing both report and impression base prompts in the same table

-- Add the impression_base_prompt column if it doesn't exist
ALTER TABLE global_base_prompt 
ADD COLUMN IF NOT EXISTS impression_base_prompt TEXT;

-- Update the existing row with default impression prompt
UPDATE global_base_prompt 
SET impression_base_prompt = E'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.'
WHERE id = 1 AND impression_base_prompt IS NULL;

-- Make the column NOT NULL after setting default value
ALTER TABLE global_base_prompt 
ALTER COLUMN impression_base_prompt SET NOT NULL;

-- Update the get function to return both prompts
CREATE OR REPLACE FUNCTION get_global_base_prompts()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'report_prompt', base_prompt,
        'impression_prompt', impression_base_prompt
    ) INTO result
    FROM global_base_prompt
    WHERE id = 1;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update impression base prompt (tier 4 users only)
CREATE OR REPLACE FUNCTION update_global_impression_prompt(
    new_prompt TEXT,
    updating_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    user_tier INTEGER;
BEGIN
    -- Check if user is tier 4 from user_subscriptions table
    SELECT tier INTO user_tier
    FROM user_subscriptions
    WHERE user_id = updating_user_id;
    
    -- If no subscription record, user is tier 1 by default
    IF user_tier IS NULL THEN
        user_tier := 1;
    END IF;
    
    IF user_tier != 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only tier 4 users can update the global impression prompt'
        );
    END IF;
    
    -- Update the global impression prompt
    UPDATE global_base_prompt
    SET 
        impression_base_prompt = new_prompt,
        updated_by = updating_user_id,
        updated_at = NOW()
    WHERE id = 1;
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_at', NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_global_base_prompts() TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_impression_prompt(TEXT, UUID) TO authenticated;

-- Quick test to verify
SELECT 
    'Global Impression Prompt Setup' as status,
    EXISTS(
        SELECT 1 FROM global_base_prompt 
        WHERE id = 1 AND impression_base_prompt IS NOT NULL
    ) as impression_prompt_exists;