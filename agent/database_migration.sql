-- Optional migration to add agent_logic column to templates table
-- The agent system will work without this column using backward compatibility

-- Add the agent_logic column as JSONB
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic JSONB;

-- Create an index on the agent_logic column for better performance
CREATE INDEX IF NOT EXISTS idx_templates_agent_logic 
ON templates USING GIN (agent_logic);

-- Example of updating a template with agent_logic
-- UPDATE templates 
-- SET agent_logic = '{
--   "version": "1.0",
--   "formatting": {
--     "preserve_template_punctuation": true,
--     "use_bullet_points": true
--   },
--   "report": {
--     "no_hallucinated_findings": true,
--     "expand_lesions": true
--   },
--   "impression": {
--     "numerically_itemized": true,
--     "concise_summary": true
--   }
-- }'::jsonb
-- WHERE user_id = 'your-user-id' AND study_type = 'MRI Knee';

-- Note: You can run this migration in your Supabase SQL editor
-- The system will continue to work with existing templates using fallback logic