-- Fix the global base prompt to remove ALL placeholder text
-- The template, findings, and rules will be inserted dynamically by the code
-- The base prompt should ONLY contain the initial role instruction

UPDATE global_base_prompt 
SET base_prompt = E'You are an expert radiologist generating a comprehensive radiology report.',
    updated_at = NOW()
WHERE id = 1;

-- Verify the update
SELECT 
    'Global Base Prompt Fixed' as status,
    length(base_prompt) as prompt_length,
    base_prompt,
    updated_at
FROM global_base_prompt
WHERE id = 1;