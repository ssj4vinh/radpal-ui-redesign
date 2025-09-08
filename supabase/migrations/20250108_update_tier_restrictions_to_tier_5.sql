-- Update tier restrictions to tier 5+ for global prompt functions

-- Drop existing functions first
DROP FUNCTION IF EXISTS update_global_base_prompt(UUID, TEXT);
DROP FUNCTION IF EXISTS update_global_impression_prompt(UUID, TEXT);
DROP FUNCTION IF EXISTS update_global_findings_rules(UUID, JSONB);
DROP FUNCTION IF EXISTS update_global_impression_rules(UUID, JSONB);

-- Recreate the update_global_base_prompt function with tier 5+ restriction
CREATE OR REPLACE FUNCTION update_global_base_prompt(p_user_id UUID, p_prompt TEXT)
RETURNS jsonb AS $$
DECLARE
    user_tier INT;
BEGIN
    -- Get the user's tier
    SELECT tier INTO user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF user_tier IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User subscription not found'
        );
    END IF;
    
    -- Changed from tier != 4 to tier < 5
    IF user_tier < 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only tier 5+ users can update the global base prompt'
        );
    END IF;
    
    -- Check if a record exists (id is integer, always 1)
    IF EXISTS (SELECT 1 FROM global_base_prompt WHERE id = 1) THEN
        -- Update existing record
        UPDATE global_base_prompt 
        SET 
            prompt = p_prompt,
            updated_at = NOW(),
            updated_by = p_user_id
        WHERE id = 1;
    ELSE
        -- Insert new record (with id = 1)
        INSERT INTO global_base_prompt (id, prompt, updated_by, created_at, updated_at)
        VALUES (1, p_prompt, p_user_id, NOW(), NOW());
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Global base prompt updated successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- Recreate the update_global_impression_prompt function with tier 5+ restriction
CREATE OR REPLACE FUNCTION update_global_impression_prompt(p_user_id UUID, p_prompt TEXT)
RETURNS jsonb AS $$
DECLARE
    user_tier INT;
BEGIN
    -- Get the user's tier
    SELECT tier INTO user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF user_tier IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User subscription not found'
        );
    END IF;
    
    -- Changed from tier != 4 to tier < 5
    IF user_tier < 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only tier 5+ users can update the global impression prompt'
        );
    END IF;
    
    -- Check if a record exists
    IF EXISTS (SELECT 1 FROM global_base_prompt WHERE id = 1) THEN
        -- Update existing record
        UPDATE global_base_prompt 
        SET 
            impression_prompt = p_prompt,
            updated_at = NOW(),
            updated_by = p_user_id
        WHERE id = 1;
    ELSE
        -- Insert new record with impression prompt
        INSERT INTO global_base_prompt (id, impression_prompt, updated_by, created_at, updated_at)
        VALUES (1, p_prompt, p_user_id, NOW(), NOW());
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Global impression prompt updated successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to allow tier 5+ access
DROP POLICY IF EXISTS "Tier 5+ users can insert global_base_prompt" ON global_base_prompt;
DROP POLICY IF EXISTS "Tier 5+ users can update global_base_prompt" ON global_base_prompt;
DROP POLICY IF EXISTS "Tier 4 users can insert global_base_prompt" ON global_base_prompt;
DROP POLICY IF EXISTS "Tier 4 users can update global_base_prompt" ON global_base_prompt;

CREATE POLICY "Tier 5+ users can insert global_base_prompt" ON global_base_prompt
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier >= 5
        )
    );

CREATE POLICY "Tier 5+ users can update global_base_prompt" ON global_base_prompt
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_id = auth.uid() 
            AND tier >= 5
        )
    );

-- Update global findings rules function
CREATE OR REPLACE FUNCTION update_global_findings_rules(p_user_id UUID, p_rules jsonb)
RETURNS jsonb AS $$
DECLARE
    user_tier INT;
BEGIN
    -- Get the user's tier
    SELECT tier INTO user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF user_tier IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User subscription not found'
        );
    END IF;
    
    -- Changed to tier < 5
    IF user_tier < 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only tier 5+ users can update global findings rules'
        );
    END IF;
    
    -- Check if a record exists
    IF EXISTS (SELECT 1 FROM global_base_prompt WHERE id = 1) THEN
        -- Update existing record
        UPDATE global_base_prompt 
        SET 
            findings_rules = p_rules,
            updated_at = NOW(),
            updated_by = p_user_id
        WHERE id = 1;
    ELSE
        -- Insert new record
        INSERT INTO global_base_prompt (id, findings_rules, updated_by, created_at, updated_at)
        VALUES (1, p_rules, p_user_id, NOW(), NOW());
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Global findings rules updated successfully'
    );
END;
$$ LANGUAGE plpgsql;

-- Update global impression rules function
CREATE OR REPLACE FUNCTION update_global_impression_rules(p_user_id UUID, p_rules jsonb)
RETURNS jsonb AS $$
DECLARE
    user_tier INT;
BEGIN
    -- Get the user's tier
    SELECT tier INTO user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF user_tier IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User subscription not found'
        );
    END IF;
    
    -- Changed to tier < 5
    IF user_tier < 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only tier 5+ users can update global impression rules'
        );
    END IF;
    
    -- Check if a record exists
    IF EXISTS (SELECT 1 FROM global_base_prompt WHERE id = 1) THEN
        -- Update existing record
        UPDATE global_base_prompt 
        SET 
            impression_rules = p_rules,
            updated_at = NOW(),
            updated_by = p_user_id
        WHERE id = 1;
    ELSE
        -- Insert new record
        INSERT INTO global_base_prompt (id, impression_rules, updated_by, created_at, updated_at)
        VALUES (1, p_rules, p_user_id, NOW(), NOW());
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Global impression rules updated successfully'
    );
END;
$$ LANGUAGE plpgsql;