-- SQL Migration to add keywords column to templates table
-- Run this in your Supabase SQL Editor

-- 1. Add the keywords column to the templates table
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- 2. Add a comment to describe the column
COMMENT ON COLUMN templates.keywords IS 'Array of keywords for template suggestion and matching';

-- 3. Create an index for better performance when searching keywords
CREATE INDEX IF NOT EXISTS idx_templates_keywords 
ON templates USING GIN (keywords);

-- 4. Update RLS policies if needed (optional - only if you have RLS enabled)
-- This ensures users can read/write their own template keywords

-- Example: If you have existing RLS policies, you might need to update them
-- The keywords column will automatically be included in existing SELECT/UPDATE/INSERT policies

-- 5. Optionally, populate default keywords for existing templates
-- You can customize these based on your needs

UPDATE templates SET keywords = ARRAY['hip', 'acetabulum', 'femoral head', 'labrum'] 
WHERE study_type = 'MRI Hip' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['knee', 'meniscus', 'acl', 'pcl', 'patella'] 
WHERE study_type = 'MRI Knee' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['shoulder', 'rotator cuff', 'labrum', 'acromion', 'humeral head'] 
WHERE study_type = 'MRI Shoulder' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['lumbar', 'disc', 'vertebra', 'canal', 'nerve root'] 
WHERE study_type = 'MRI Lumbar Spine' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['cervical', 'disc', 'cord', 'vertebra', 'canal'] 
WHERE study_type = 'MRI Cervical Spine' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['ankle', 'talus', 'tibia', 'fibula', 'ligament'] 
WHERE study_type = 'MRI Ankle' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['wrist', 'carpal', 'tfcc', 'scaphoid', 'lunate'] 
WHERE study_type = 'MRI Wrist' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['elbow', 'epicondyle', 'ulnar', 'radial', 'ligament'] 
WHERE study_type = 'MRI Elbow' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['thoracic', 'disc', 'vertebra', 'cord', 'canal'] 
WHERE study_type = 'MRI Thoracic Spine' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['foot', 'metatarsal', 'plantar', 'fascia', 'calcaneus'] 
WHERE study_type = 'MRI Foot' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['hand', 'metacarpal', 'phalanx', 'tendon', 'carpal'] 
WHERE study_type = 'MRI Hand' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['abdomen', 'pelvis', 'liver', 'kidney', 'bowel'] 
WHERE study_type = 'CT Abdomen Pelvis' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['chest', 'lung', 'mediastinum', 'pleural', 'thorax'] 
WHERE study_type = 'CT Chest' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['pulmonary', 'embolism', 'pe', 'artery', 'vessel'] 
WHERE study_type = 'CT Pulmonary Embolism' AND keywords = '{}';

UPDATE templates SET keywords = ARRAY['head', 'brain', 'skull', 'sinus', 'ventricle'] 
WHERE study_type = 'CT Head' AND keywords = '{}';

-- Verify the migration
SELECT study_type, keywords 
FROM templates 
WHERE user_id = auth.uid() 
LIMIT 5;