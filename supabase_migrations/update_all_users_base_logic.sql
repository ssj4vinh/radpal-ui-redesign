-- Script to update base logic for ALL users in the system
-- This will update the default_agent_logic in the user_default_logic table

-- First, let's see how many users have base logic entries
SELECT 
    COUNT(*) as total_users_with_base_logic,
    COUNT(DISTINCT user_id) as unique_users
FROM user_default_logic;

-- Check a sample of current base logic settings (first 5 users)
SELECT 
    user_id,
    default_agent_logic->>'version' as version,
    default_agent_logic->'general'->'tone'->>'style' as tone_style,
    default_agent_logic->'report'->'language'->>'expand_lesion_descriptions' as expand_lesions,
    updated_at
FROM user_default_logic
LIMIT 5;

-- IMPORTANT: This will update ALL users' base logic
-- You can modify the JSON structure below to set the base logic as needed
UPDATE user_default_logic
SET 
    default_agent_logic = jsonb_build_object(
        'version', '3.0',
        'general', jsonb_build_object(
            'corrections', jsonb_build_object(
                'rules', '[]'::jsonb  -- Add any global corrections here
            ),
            'tone', jsonb_build_object(
                'style', 'balanced'  -- Change to 'definitive', 'cautious', or 'balanced'
            ),
            'allowed_sections', jsonb_build_object(
                'enabled', true,
                'sections', '["FINDINGS", "IMPRESSION"]'::jsonb
            ),
            'disallowed_symbols', jsonb_build_object(
                'enabled', true,
                'symbols', '["*", "**", "###", "##"]'::jsonb
            ),
            'disallowed_items', jsonb_build_object(
                'patient_identifiers', true,
                'names', true,
                'radiology_report_title', true,
                'referring_physician', true,
                'radiologist_signature', true,
                'credentials', true,
                'date', true
            )
        ),
        'report', jsonb_build_object(
            'formatting', jsonb_build_object(
                'use_bullet_points', false,
                'preserve_template_punctuation', true,
                'prevent_unnecessary_capitalization', true,
                'preserve_spacing_and_capitalization', true
            ),
            'language', jsonb_build_object(
                'avoid_words', jsonb_build_object(
                    'enabled', false,
                    'words', '[]'::jsonb
                ),
                'avoid_phrases', jsonb_build_object(
                    'enabled', false,
                    'phrases', '[]'::jsonb
                ),
                'expand_lesion_descriptions', false  -- Set to true if you want expanded descriptions
            )
        ),
        'impression', jsonb_build_object(
            'format', jsonb_build_object(
                'style', 'numerically_itemized',  -- Options: 'numerically_itemized', 'bullet_points', 'none'
                'spacing', 'double'  -- Options: 'single', 'double'
            ),
            'exclude_by_default', '[]'::jsonb  -- Add any default exclusions here
        ),
        'custom_instructions', '[]'::jsonb  -- Add any global custom instructions here
    ),
    updated_at = NOW()
WHERE 1=1;  -- This WHERE clause updates ALL rows

-- Verify the update
SELECT 
    COUNT(*) as updated_users,
    MIN(updated_at) as oldest_update,
    MAX(updated_at) as newest_update
FROM user_default_logic
WHERE updated_at > NOW() - INTERVAL '1 minute';

-- Show sample of updated records
SELECT 
    user_id,
    default_agent_logic->>'version' as version,
    default_agent_logic->'general'->'tone'->>'style' as tone_style,
    default_agent_logic->'report'->'language'->>'expand_lesion_descriptions' as expand_lesions,
    updated_at
FROM user_default_logic
ORDER BY updated_at DESC
LIMIT 5;

-- OPTIONAL: Create new base logic entries for users who don't have them yet
-- This will add base logic for any users in auth.users who don't have an entry
INSERT INTO user_default_logic (user_id, default_agent_logic, created_at, updated_at)
SELECT 
    au.id as user_id,
    jsonb_build_object(
        'version', '3.0',
        'general', jsonb_build_object(
            'corrections', jsonb_build_object(
                'rules', '[]'::jsonb
            ),
            'tone', jsonb_build_object(
                'style', 'balanced'
            ),
            'allowed_sections', jsonb_build_object(
                'enabled', true,
                'sections', '["FINDINGS", "IMPRESSION"]'::jsonb
            ),
            'disallowed_symbols', jsonb_build_object(
                'enabled', true,
                'symbols', '["*", "**", "###", "##"]'::jsonb
            ),
            'disallowed_items', jsonb_build_object(
                'patient_identifiers', true,
                'names', true,
                'radiology_report_title', true,
                'referring_physician', true,
                'radiologist_signature', true,
                'credentials', true,
                'date', true
            )
        ),
        'report', jsonb_build_object(
            'formatting', jsonb_build_object(
                'use_bullet_points', false,
                'preserve_template_punctuation', true,
                'prevent_unnecessary_capitalization', true,
                'preserve_spacing_and_capitalization', true
            ),
            'language', jsonb_build_object(
                'avoid_words', jsonb_build_object(
                    'enabled', false,
                    'words', '[]'::jsonb
                ),
                'avoid_phrases', jsonb_build_object(
                    'enabled', false,
                    'phrases', '[]'::jsonb
                ),
                'expand_lesion_descriptions', false
            )
        ),
        'impression', jsonb_build_object(
            'format', jsonb_build_object(
                'style', 'numerically_itemized',
                'spacing', 'double'
            ),
            'exclude_by_default', '[]'::jsonb
        ),
        'custom_instructions', '[]'::jsonb
    ) as default_agent_logic,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users au
LEFT JOIN user_default_logic udl ON au.id = udl.user_id
WHERE udl.user_id IS NULL;

-- Final count
SELECT 
    'Total users with base logic' as metric,
    COUNT(*) as count
FROM user_default_logic;