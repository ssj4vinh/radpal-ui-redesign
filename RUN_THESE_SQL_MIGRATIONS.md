# SQL Migrations for Global Prompt Sections

## Instructions

Run these SQL commands in your Supabase Dashboard SQL Editor in this exact order:

1. Go to: https://app.supabase.com/project/_/sql
2. Run each SQL file in order
3. Check for success messages after each step

## Step 1: Create the Table

Run the contents of `create_agent_logic_layers.sql`:

```sql
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
```

## Step 2: Create the Functions

Run the contents of `create_global_functions.sql`:

```sql
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
```

## Step 3: Create Additional V2 Functions (Optional but Recommended)

```sql
-- Function to update base logic
CREATE OR REPLACE FUNCTION update_base_logic_v2(p_user_id UUID, p_base_logic JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_logic_layers
  SET default_agent_logic = p_base_logic,
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id 
    AND layer_type = 'base';
    
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
    
  IF NOT FOUND THEN
    INSERT INTO agent_logic_layers (user_id, layer_type, study_type, default_agent_logic)
    VALUES (p_user_id, 'study', p_study_type, p_study_logic);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_base_logic_v2(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_study_logic_v2(UUID, TEXT, JSONB) TO authenticated;
```

## Verification

After running the migrations, verify everything works:

1. Check that the table exists:
```sql
SELECT * FROM agent_logic_layers LIMIT 1;
```

2. Check that functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%global%' 
   OR routine_name LIKE '%logic_v2%';
```

## Troubleshooting

If you get an error:
- Make sure you're copying the SQL exactly (no extra characters)
- Run each section separately
- Check for success messages after each command
- If a table/function already exists, you might see a notice - that's OK