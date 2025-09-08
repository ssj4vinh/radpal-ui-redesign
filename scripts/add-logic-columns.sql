-- Add new columns for agent logic v2 if they don't exist
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB,
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS default_agent_logic JSONB,
ADD COLUMN IF NOT EXISTS default_agent_logic_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments to describe the columns
COMMENT ON COLUMN templates.agent_logic_2 IS 'Study-specific logic using v3.0 schema (separate from base logic)';
COMMENT ON COLUMN templates.agent_logic_2_updated_at IS 'Timestamp when agent_logic_2 was last updated';
COMMENT ON COLUMN templates.default_agent_logic IS 'Base/default logic that applies to all study types for this user';
COMMENT ON COLUMN templates.default_agent_logic_updated_at IS 'Timestamp when default_agent_logic was last updated';