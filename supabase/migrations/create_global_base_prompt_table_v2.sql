-- Create a separate table for storing the global base prompt
-- This avoids foreign key constraints with the users table

-- Drop table if exists (for development)
DROP TABLE IF EXISTS global_base_prompt CASCADE;

-- Create the global base prompt table
CREATE TABLE global_base_prompt (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures only one row
    base_prompt TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default global base prompt (simple role instruction only)
-- Template, findings, and rules will be added dynamically by the application
INSERT INTO global_base_prompt (base_prompt, created_at, updated_at)
VALUES (
    E'You are an expert radiologist generating a comprehensive radiology report.',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE global_base_prompt ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Everyone can read the global base prompt
CREATE POLICY "Everyone can read global base prompt"
    ON global_base_prompt
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (true);

-- Only tier 4 users can update the global base prompt
CREATE POLICY "Tier 4 users can update global base prompt"
    ON global_base_prompt
    AS PERMISSIVE
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier = 4
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier = 4
        )
    );

-- Create function to get global base prompt
CREATE OR REPLACE FUNCTION get_global_base_prompt()
RETURNS TEXT AS $$
DECLARE
    prompt TEXT;
BEGIN
    SELECT base_prompt INTO prompt
    FROM global_base_prompt
    WHERE id = 1;
    
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
    
    -- Update the global base prompt
    UPDATE global_base_prompt
    SET 
        base_prompt = new_prompt,
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
GRANT SELECT ON global_base_prompt TO authenticated;
GRANT UPDATE ON global_base_prompt TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_base_prompt() TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_base_prompt(TEXT, UUID) TO authenticated;

-- Create an index for faster lookups (though there's only one row)
CREATE INDEX IF NOT EXISTS idx_global_base_prompt_id ON global_base_prompt(id);

-- Quick test to verify
SELECT 
    'Global Base Prompt Setup' as status,
    EXISTS(
        SELECT 1 FROM global_base_prompt 
        WHERE id = 1
    ) as global_prompt_exists;