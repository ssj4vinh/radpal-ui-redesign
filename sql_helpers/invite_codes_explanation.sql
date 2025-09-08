-- ============================================
-- INVITE CODES STRUCTURE EXPLANATION
-- ============================================

-- You have the CORRECT setup with:
-- 1. invite_codes (TABLE) - Stores the actual invite codes
-- 2. invite_codes_usage (VIEW) - Reporting view with joined user data

-- ============================================
-- MAIN TABLE: invite_codes
-- ============================================
-- This is where invite codes are stored and managed

-- Check the table structure
\d invite_codes

-- View current codes
SELECT 
    code,
    used_by,
    email,
    first_name,
    last_name,
    created_at,
    used_at,
    CASE 
        WHEN used_by IS NULL THEN '✅ Available'
        ELSE '❌ Used'
    END as status
FROM invite_codes
ORDER BY created_at DESC;

-- ============================================
-- REPORTING VIEW: invite_codes_usage
-- ============================================
-- This VIEW joins invite_codes with user data for comprehensive reporting

-- View the complete usage report
SELECT 
    code,
    status,
    email,
    first_name,
    last_name,
    auth_email,
    user_tier,
    code_created_at,
    used_at,
    user_created_at,
    hours_to_use
FROM invite_codes_usage
ORDER BY code_created_at DESC;

-- ============================================
-- COMMON OPERATIONS
-- ============================================

-- 1. Add new invite codes
INSERT INTO invite_codes (code, created_at)
VALUES 
    ('RADPAL2024', NOW()),
    ('WELCOME2024', NOW()),
    ('BETA2024', NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Check available codes
SELECT code 
FROM invite_codes 
WHERE used_by IS NULL
ORDER BY created_at DESC;

-- 3. See who used which codes (using the VIEW)
SELECT 
    code,
    email,
    first_name || ' ' || last_name as full_name,
    user_tier,
    used_at
FROM invite_codes_usage
WHERE status = 'Used'
ORDER BY used_at DESC;

-- 4. Generate batch of new codes
INSERT INTO invite_codes (code, created_at)
SELECT 
    'JAN25-' || upper(substr(md5(random()::text || i::text), 1, 6)) as code,
    NOW() as created_at
FROM generate_series(1, 10) as i;

-- 5. Check usage statistics
SELECT 
    COUNT(*) as total_codes,
    COUNT(used_by) as used_codes,
    COUNT(*) - COUNT(used_by) as available_codes,
    ROUND(100.0 * COUNT(used_by) / COUNT(*), 2) as usage_percentage
FROM invite_codes;

-- 6. Find codes that were created but never used (older than 30 days)
SELECT 
    code,
    created_at,
    AGE(NOW(), created_at) as age
FROM invite_codes
WHERE used_by IS NULL
    AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at;

-- 7. Track signup velocity using the VIEW
SELECT 
    DATE(used_at) as signup_date,
    COUNT(*) as signups,
    STRING_AGG(first_name || ' ' || last_name, ', ') as users
FROM invite_codes_usage
WHERE used_at IS NOT NULL
GROUP BY DATE(used_at)
ORDER BY signup_date DESC
LIMIT 30;

-- ============================================
-- UNDERSTANDING THE RELATIONSHIP
-- ============================================

/*
The invite_codes TABLE stores:
- code (unique invite code)
- used_by (user_id who used it)
- email (email of user who used it)
- first_name (first name of user)
- last_name (last name of user)
- created_at (when code was created)
- used_at (when code was used)

The invite_codes_usage VIEW adds:
- auth_email (from auth.users table)
- user_tier (from user_subscriptions table)
- user_created_at (when user account was created)
- status (computed: 'Available' or 'Used')
- hours_to_use (computed: time between code creation and use)

This design allows you to:
1. Quickly check/validate codes during signup (using the table)
2. Generate comprehensive reports (using the view)
3. Track user information with the invite code they used
*/

-- ============================================
-- NO ACTION NEEDED
-- ============================================
-- Your current setup is correct and optimal!
-- The "two tables" you see are actually:
-- - 1 table (invite_codes) for data storage
-- - 1 view (invite_codes_usage) for reporting
-- This is the recommended approach.