-- Add missing columns for findings_rules and impression_rules to global_base_prompt table

-- Add findings_rules column if it doesn't exist
ALTER TABLE global_base_prompt 
ADD COLUMN IF NOT EXISTS findings_rules JSONB;

-- Add impression_rules column if it doesn't exist  
ALTER TABLE global_base_prompt 
ADD COLUMN IF NOT EXISTS impression_rules JSONB;

-- Add global_findings_rules column if it doesn't exist (for consistency)
ALTER TABLE global_base_prompt 
ADD COLUMN IF NOT EXISTS global_findings_rules JSONB;

-- Add global_impression_rules column if it doesn't exist (for consistency)
ALTER TABLE global_base_prompt 
ADD COLUMN IF NOT EXISTS global_impression_rules JSONB;