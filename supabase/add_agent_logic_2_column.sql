-- Add agent_logic_2 column to templates table if it doesn't exist

-- Add the column if it doesn't exist
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB DEFAULT '{}'::jsonb;

-- Add updated timestamp column for tracking when agent_logic_2 was last modified
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Create an index for faster queries on agent_logic_2
CREATE INDEX IF NOT EXISTS idx_templates_agent_logic_2 ON templates USING GIN (agent_logic_2);

-- Update existing rows to have a default structure for agent_logic_2
UPDATE templates 
SET agent_logic_2 = '{
    "version": "1.0",
    "study_report": {
        "anatomic_routing_rules": [],
        "custom_rules": []
    },
    "study_impression": {
        "required_opening_phrase": {
            "enabled": false,
            "phrase": ""
        },
        "priority": {
            "high_priority_findings": [],
            "high_priority_keywords": [],
            "mid_priority_findings": [],
            "mid_priority_keywords": [],
            "low_priority_findings": [],
            "low_priority_keywords": []
        },
        "exclude_by_default": [],
        "grouping_strategy": "severity",
        "auto_reordering": true,
        "custom_rules": []
    }
}'::jsonb
WHERE agent_logic_2 IS NULL OR agent_logic_2 = '{}'::jsonb;

-- Verify the column exists
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'templates' 
AND column_name IN ('agent_logic_2', 'agent_logic_2_updated_at')
ORDER BY column_name;