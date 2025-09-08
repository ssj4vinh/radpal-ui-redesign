-- Fix the update functions to use the global_base_prompt table instead of agent_logic_layers

-- Drop the old functions first
DROP FUNCTION IF EXISTS update_global_findings_rules(UUID, JSONB);
DROP FUNCTION IF EXISTS update_global_impression_rules(UUID, JSONB);

-- Create function to update global findings rules (using global_base_prompt table)
CREATE OR REPLACE FUNCTION update_global_findings_rules(p_user_id UUID, p_rules JSONB)
RETURNS VOID AS $$
DECLARE
    v_user_tier INTEGER;
BEGIN
    -- Get user tier from user_subscriptions table
    SELECT tier INTO v_user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- Check if user has tier 5 permission
    IF v_user_tier IS NULL OR v_user_tier < 5 THEN
        RAISE EXCEPTION 'Only tier 5 users can update global findings rules';
    END IF;
    
    -- Update the global_base_prompt table (id = 1 for the global entry)
    UPDATE global_base_prompt
    SET global_findings_rules = p_rules,
        updated_at = timezone('utc'::text, now())
    WHERE id = 1;
    
    -- If no row exists with id = 1, create it
    IF NOT FOUND THEN
        INSERT INTO global_base_prompt (id, global_findings_rules, updated_at)
        VALUES (1, p_rules, timezone('utc'::text, now()));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update global impression rules (using global_base_prompt table)
CREATE OR REPLACE FUNCTION update_global_impression_rules(p_user_id UUID, p_rules JSONB)
RETURNS VOID AS $$
DECLARE
    v_user_tier INTEGER;
BEGIN
    -- Get user tier from user_subscriptions table
    SELECT tier INTO v_user_tier 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- Check if user has tier 5 permission
    IF v_user_tier IS NULL OR v_user_tier < 5 THEN
        RAISE EXCEPTION 'Only tier 5 users can update global impression rules';
    END IF;
    
    -- Update the global_base_prompt table (id = 1 for the global entry)
    UPDATE global_base_prompt
    SET global_impression_rules = p_rules,
        updated_at = timezone('utc'::text, now())
    WHERE id = 1;
    
    -- If no row exists with id = 1, create it
    IF NOT FOUND THEN
        INSERT INTO global_base_prompt (id, global_impression_rules, updated_at)
        VALUES (1, p_rules, timezone('utc'::text, now()));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_global_findings_rules(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_impression_rules(UUID, JSONB) TO authenticated;