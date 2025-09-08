-- Create agent_logic_layers table for V2 logic system
CREATE TABLE IF NOT EXISTS agent_logic_layers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('base', 'study')),
  study_type TEXT, -- NULL for base layer, specific study type for study layers
  
  -- Base prompts
  report_base_prompt TEXT,
  impression_base_prompt TEXT,
  
  -- Global section rules (only used in base layer)
  global_findings_rules JSONB DEFAULT NULL,
  global_impression_rules JSONB DEFAULT NULL,
  
  -- Logic content
  default_agent_logic JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique base layer per user
  CONSTRAINT unique_base_layer UNIQUE(user_id, layer_type) WHERE layer_type = 'base',
  -- Ensure unique study layer per user and study type
  CONSTRAINT unique_study_layer UNIQUE(user_id, study_type) WHERE layer_type = 'study'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_logic_layers_user_id ON agent_logic_layers(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logic_layers_layer_type ON agent_logic_layers(layer_type);
CREATE INDEX IF NOT EXISTS idx_agent_logic_layers_study_type ON agent_logic_layers(study_type);

-- Enable RLS
ALTER TABLE agent_logic_layers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own logic layers"
  ON agent_logic_layers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logic layers"
  ON agent_logic_layers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logic layers"
  ON agent_logic_layers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logic layers"
  ON agent_logic_layers FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to get or create base logic layer
CREATE OR REPLACE FUNCTION get_or_create_base_logic(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  layer_type TEXT,
  default_agent_logic JSONB,
  report_base_prompt TEXT,
  impression_base_prompt TEXT,
  global_findings_rules JSONB,
  global_impression_rules JSONB
) AS $$
BEGIN
  -- First try to get existing base layer
  RETURN QUERY
  SELECT 
    all_layers.id,
    all_layers.user_id,
    all_layers.layer_type,
    all_layers.default_agent_logic,
    all_layers.report_base_prompt,
    all_layers.impression_base_prompt,
    all_layers.global_findings_rules,
    all_layers.global_impression_rules
  FROM agent_logic_layers all_layers
  WHERE all_layers.user_id = p_user_id 
    AND all_layers.layer_type = 'base';
  
  -- If no rows returned, create a new base layer
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, default_agent_logic)
    VALUES (p_user_id, 'base', '{}'::jsonb)
    RETURNING 
      agent_logic_layers.id,
      agent_logic_layers.user_id,
      agent_logic_layers.layer_type,
      agent_logic_layers.default_agent_logic,
      agent_logic_layers.report_base_prompt,
      agent_logic_layers.impression_base_prompt,
      agent_logic_layers.global_findings_rules,
      agent_logic_layers.global_impression_rules
    INTO 
      id,
      user_id,
      layer_type,
      default_agent_logic,
      report_base_prompt,
      impression_base_prompt,
      global_findings_rules,
      global_impression_rules;
    
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get or create study logic layer
CREATE OR REPLACE FUNCTION get_or_create_study_logic(p_user_id UUID, p_study_type TEXT)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  layer_type TEXT,
  study_type TEXT,
  default_agent_logic JSONB
) AS $$
BEGIN
  -- First try to get existing study layer
  RETURN QUERY
  SELECT 
    all_layers.id,
    all_layers.user_id,
    all_layers.layer_type,
    all_layers.study_type,
    all_layers.default_agent_logic
  FROM agent_logic_layers all_layers
  WHERE all_layers.user_id = p_user_id 
    AND all_layers.layer_type = 'study'
    AND all_layers.study_type = p_study_type;
  
  -- If no rows returned, create a new study layer
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, study_type, default_agent_logic)
    VALUES (p_user_id, 'study', p_study_type, '{}'::jsonb)
    RETURNING 
      agent_logic_layers.id,
      agent_logic_layers.user_id,
      agent_logic_layers.layer_type,
      agent_logic_layers.study_type,
      agent_logic_layers.default_agent_logic
    INTO 
      id,
      user_id,
      layer_type,
      study_type,
      default_agent_logic;
    
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get global prompt sections
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
    
  -- Create base layer if it doesn't exist
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
    
  -- Create base layer if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, global_impression_rules)
    VALUES (p_user_id, 'base', p_rules);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update base logic
CREATE OR REPLACE FUNCTION update_base_logic_v2(p_user_id UUID, p_base_logic JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_logic_layers
  SET default_agent_logic = p_base_logic,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id 
    AND layer_type = 'base';
    
  -- Create base layer if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, default_agent_logic)
    VALUES (p_user_id, 'base', p_base_logic);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update study logic
CREATE OR REPLACE FUNCTION update_study_logic_v2(p_user_id UUID, p_study_type TEXT, p_study_logic JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_logic_layers
  SET default_agent_logic = p_study_logic,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id 
    AND layer_type = 'study'
    AND study_type = p_study_type;
    
  -- Create study layer if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, study_type, default_agent_logic)
    VALUES (p_user_id, 'study', p_study_type, p_study_logic);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset logic to defaults
CREATE OR REPLACE FUNCTION reset_logic_v2(p_user_id UUID, p_study_type TEXT)
RETURNS VOID AS $$
BEGIN
  -- Delete both base and study layers for clean reset
  DELETE FROM agent_logic_layers
  WHERE user_id = p_user_id 
    AND (layer_type = 'base' OR (layer_type = 'study' AND study_type = p_study_type));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_base_logic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_study_logic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_prompt_sections(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_findings_rules(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_global_impression_rules(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_base_logic_v2(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_study_logic_v2(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_logic_v2(UUID, TEXT) TO authenticated;