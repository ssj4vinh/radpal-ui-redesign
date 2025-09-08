-- Add default_agent_logic column to templates table
-- This stores the base logic that applies to all study types for a user

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS default_agent_logic JSONB;

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_templates_default_agent_logic 
ON templates USING gin(default_agent_logic);

-- Add last_updated timestamps for tracking changes
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS default_agent_logic_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create triggers to update timestamps
CREATE OR REPLACE FUNCTION update_agent_logic_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.agent_logic IS DISTINCT FROM OLD.agent_logic THEN
        NEW.agent_logic_updated_at = NOW();
    END IF;
    IF NEW.default_agent_logic IS DISTINCT FROM OLD.default_agent_logic THEN
        NEW.default_agent_logic_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_logic_timestamp_trigger ON templates;
CREATE TRIGGER update_agent_logic_timestamp_trigger
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION update_agent_logic_timestamp();

-- Migrate existing data: Copy current agent_logic to default_agent_logic for existing templates
-- Only for the first template of each user (as default logic should be shared)
WITH first_templates AS (
    SELECT DISTINCT ON (user_id) 
        id, 
        user_id, 
        agent_logic
    FROM templates
    WHERE agent_logic IS NOT NULL
    ORDER BY user_id, created_at ASC
)
UPDATE templates t
SET default_agent_logic = ft.agent_logic
FROM first_templates ft
WHERE t.user_id = ft.user_id
  AND t.default_agent_logic IS NULL;