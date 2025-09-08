-- Create a separate table for user default logic (one per user)
CREATE TABLE IF NOT EXISTS user_default_logic (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    default_agent_logic JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_default_logic_user_id 
ON user_default_logic(user_id);

-- Create trigger to update timestamp
CREATE OR REPLACE FUNCTION update_user_default_logic_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_default_logic_timestamp_trigger ON user_default_logic;
CREATE TRIGGER update_user_default_logic_timestamp_trigger
BEFORE UPDATE ON user_default_logic
FOR EACH ROW
EXECUTE FUNCTION update_user_default_logic_timestamp();

-- Migrate existing data: Take the agent_logic from the first template of each user as their default
INSERT INTO user_default_logic (user_id, default_agent_logic)
SELECT DISTINCT ON (user_id) 
    user_id, 
    COALESCE(agent_logic, '{}'::jsonb) as default_agent_logic
FROM templates
WHERE user_id IS NOT NULL
ORDER BY user_id, created_at ASC
ON CONFLICT (user_id) DO NOTHING;

-- Add RLS policies
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

-- Users can only see and edit their own default logic
CREATE POLICY "Users can view own default logic" ON user_default_logic
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own default logic" ON user_default_logic
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own default logic" ON user_default_logic
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own default logic" ON user_default_logic
    FOR DELETE USING (auth.uid() = user_id);