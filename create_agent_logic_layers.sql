-- Create agent_logic_layers table for V2 logic system
CREATE TABLE IF NOT EXISTS agent_logic_layers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('base', 'study')),
  study_type TEXT,
  report_base_prompt TEXT,
  impression_base_prompt TEXT,
  global_findings_rules JSONB DEFAULT NULL,
  global_impression_rules JSONB DEFAULT NULL,
  default_agent_logic JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_base_layer UNIQUE(user_id, layer_type) WHERE layer_type = 'base',
  CONSTRAINT unique_study_layer UNIQUE(user_id, study_type) WHERE layer_type = 'study'
);

-- Create indexes
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