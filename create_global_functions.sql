-- Function to get global prompt sections
CREATE OR REPLACE FUNCTION get_global_prompt_sections(p_user_id UUID)
RETURNS TABLE(
  report_base_prompt TEXT,
  impression_base_prompt TEXT,
  global_findings_rules JSONB,
  global_impression_rules JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    all_layers.report_base_prompt,
    all_layers.impression_base_prompt,
    all_layers.global_findings_rules,
    all_layers.global_impression_rules
  FROM agent_logic_layers all_layers
  WHERE all_layers.user_id = p_user_id 
    AND all_layers.layer_type = 'base';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update global findings rules
CREATE OR REPLACE FUNCTION update_global_findings_rules(p_user_id UUID, p_rules JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_logic_layers
  SET global_findings_rules = p_rules,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id 
    AND layer_type = 'base';
    
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, global_findings_rules)
    VALUES (p_user_id, 'base', p_rules);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update global impression rules
CREATE OR REPLACE FUNCTION update_global_impression_rules(p_user_id UUID, p_rules JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_logic_layers
  SET global_impression_rules = p_rules,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id 
    AND layer_type = 'base';
    
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, global_impression_rules)
    VALUES (p_user_id, 'base', p_rules);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_global_prompt_sections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_findings_rules(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_impression_rules(UUID, JSONB) TO authenticated;