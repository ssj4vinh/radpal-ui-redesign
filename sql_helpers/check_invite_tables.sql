-- ============================================
-- CHECK INVITE CODE TABLES STRUCTURE
-- ============================================

-- 1. Check structure of invite_codes table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'invite_codes'
ORDER BY ordinal_position;

-- 2. Check structure of invite_codes_usage table  
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'invite_codes_usage'
ORDER BY ordinal_position;

-- 3. Check sample data from invite_codes
SELECT * FROM invite_codes LIMIT 5;

-- 4. Check sample data from invite_codes_usage
SELECT * FROM invite_codes_usage LIMIT 5;

-- 5. Check if there are relationships between the tables
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (tc.table_name = 'invite_codes' OR tc.table_name = 'invite_codes_usage');

-- 6. Count records in each table
SELECT 
    'invite_codes' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE used_by IS NOT NULL) as used_codes,
    COUNT(*) FILTER (WHERE used_by IS NULL) as available_codes
FROM invite_codes
UNION ALL
SELECT 
    'invite_codes_usage' as table_name,
    COUNT(*) as total_records,
    NULL as used_codes,
    NULL as available_codes
FROM invite_codes_usage;

-- ============================================
-- ANALYSIS: Understanding the table purposes
-- ============================================

-- If invite_codes_usage is meant to track usage history:
-- Check if it has user_id and code references
SELECT 
    icu.*,
    ic.code,
    ic.created_at as code_created_at
FROM invite_codes_usage icu
LEFT JOIN invite_codes ic ON ic.code = icu.code OR ic.id = icu.invite_code_id
LIMIT 10;

-- ============================================
-- RECOMMENDED APPROACH
-- ============================================

-- Option 1: Use invite_codes as the main table (RECOMMENDED)
-- - Store codes and their usage status in invite_codes
-- - Add user tracking columns to invite_codes if not present
-- - Drop invite_codes_usage if redundant

-- Option 2: Use both tables
-- - invite_codes: Store available codes
-- - invite_codes_usage: Track usage history/audit log
-- - Useful if you need to track multiple usage attempts

-- ============================================
-- CHECK CURRENT APP REFERENCES
-- ============================================

-- See which table the app is currently using by checking RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('invite_codes', 'invite_codes_usage')
ORDER BY tablename, policyname;