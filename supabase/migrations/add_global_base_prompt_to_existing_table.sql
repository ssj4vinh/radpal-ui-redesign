-- Use the existing user_default_logic table to store global base prompt
-- We'll use a special UUID '00000000-0000-0000-0000-000000000000' to represent the global prompt

-- First, add a column to store the base prompt text (separate from logic)
ALTER TABLE user_default_logic 
ADD COLUMN IF NOT EXISTS base_prompt TEXT;

-- Add a column to indicate if this is the global base prompt
ALTER TABLE user_default_logic 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Insert or update the global base prompt row
-- Using a special UUID that represents "global" settings
INSERT INTO user_default_logic (
    user_id,
    base_prompt,
    is_global,
    default_agent_logic,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID,
    E'You are an expert radiologist generating a comprehensive radiology report.\n\n' ||
    E'TEMPLATE STRUCTURE - You MUST follow this exact structure:\n\n' ||
    E'[TEMPLATE WILL BE INSERTED HERE]\n\n' ||
    E'IMPORTANT: Preserve ALL section headers EXACTLY as shown above.\n\n' ||
    E'IMPORTANT: The following imaging findings MUST be incorporated:\n\n' ||
    E'=== FINDINGS TO INCORPORATE ===\n' ||
    E'[YOUR DICTATED FINDINGS WILL BE INSERTED HERE]\n' ||
    E'=== END OF FINDINGS ===\n\n' ||
    E'=== CRITICAL RULES ===\n' ||
    E'• You must incorporate ALL findings provided above into the appropriate sections\n' ||
    E'• The ONLY allowed sections are "Findings" and "Impression"\n' ||
    E'• Do not add any other sections (no Technique, no Comparison, no Clinical Information, etc.)\n',
    true,
    '{}'::jsonb,  -- Empty logic object for global prompt
    NOW(),
    NOW()
)
ON CONFLICT (user_id) 
DO UPDATE SET
    base_prompt = EXCLUDED.base_prompt,
    is_global = true,
    updated_at = NOW()
WHERE user_default_logic.user_id = '00000000-0000-0000-0000-000000000000'::UUID;

-- Create function to get global base prompt
CREATE OR REPLACE FUNCTION get_global_base_prompt()
RETURNS TEXT AS $$
DECLARE
    prompt TEXT;
BEGIN
    SELECT base_prompt INTO prompt
    FROM user_default_logic
    WHERE user_id = '00000000-0000-0000-0000-000000000000'::UUID
    AND is_global = true;
    
    -- Return default if not found
    IF prompt IS NULL THEN
        prompt := E'You are an expert radiologist generating a comprehensive radiology report.\n\n' ||
                  E'TEMPLATE STRUCTURE - You MUST follow this exact structure:\n\n' ||
                  E'[TEMPLATE WILL BE INSERTED HERE]\n\n' ||
                  E'IMPORTANT: Preserve ALL section headers EXACTLY as shown above.\n\n' ||
                  E'IMPORTANT: The following imaging findings MUST be incorporated:\n\n' ||
                  E'=== FINDINGS TO INCORPORATE ===\n' ||
                  E'[YOUR DICTATED FINDINGS WILL BE INSERTED HERE]\n' ||
                  E'=== END OF FINDINGS ===\n\n' ||
                  E'=== CRITICAL RULES ===\n' ||
                  E'• You must incorporate ALL findings provided above into the appropriate sections\n' ||
                  E'• The ONLY allowed sections are "Findings" and "Impression"\n' ||
                  E'• Do not add any other sections (no Technique, no Comparison, no Clinical Information, etc.)\n';
    END IF;
    
    RETURN prompt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update global base prompt (tier 4 users only)
CREATE OR REPLACE FUNCTION update_global_base_prompt(
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
            'error', 'Only tier 4 users can update the global base prompt'
        );
    END IF;
    
    -- Update or insert the global base prompt
    INSERT INTO user_default_logic (
        user_id,
        base_prompt,
        is_global,
        default_agent_logic,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID,
        new_prompt,
        true,
        '{}'::jsonb,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        base_prompt = new_prompt,
        updated_at = NOW();
    
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

-- Update RLS policy to allow everyone to read the global prompt
DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON user_default_logic;

-- Create separate policies for better control
CREATE POLICY "Users can manage their own logic"
    ON user_default_logic
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id AND user_id != '00000000-0000-0000-0000-000000000000'::UUID)
    WITH CHECK (auth.uid() = user_id AND user_id != '00000000-0000-0000-0000-000000000000'::UUID);

-- Everyone can read the global base prompt
CREATE POLICY "Everyone can read global base prompt"
    ON user_default_logic
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (user_id = '00000000-0000-0000-0000-000000000000'::UUID);

-- Only tier 4 users can update global base prompt (checked in function)
CREATE POLICY "Tier 4 users can update global base prompt"
    ON user_default_logic
    AS PERMISSIVE
    FOR UPDATE
    TO authenticated
    USING (
        user_id = '00000000-0000-0000-0000-000000000000'::UUID 
        AND EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier = 4
        )
    )
    WITH CHECK (
        user_id = '00000000-0000-0000-0000-000000000000'::UUID
        AND EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier = 4
        )
    );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_global_base_prompt() TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_base_prompt(TEXT, UUID) TO authenticated;

-- Quick test to verify
SELECT 
    'Global Base Prompt Setup' as status,
    EXISTS(
        SELECT 1 FROM user_default_logic 
        WHERE user_id = '00000000-0000-0000-0000-000000000000'::UUID
    ) as global_prompt_exists;