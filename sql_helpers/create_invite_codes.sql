-- ============================================
-- METHODS TO CREATE NEW INVITE CODES
-- ============================================

-- Method 1: Create a single invite code
INSERT INTO invite_codes (code, created_at)
VALUES ('RADPAL2024', NOW());

-- Method 2: Create multiple invite codes at once
INSERT INTO invite_codes (code, created_at)
VALUES 
    ('WELCOME2024', NOW()),
    ('BETA2024', NOW()),
    ('EARLY2024', NOW()),
    ('VIP2024', NOW()),
    ('SPECIAL2024', NOW());

-- Method 3: Generate random invite codes (alphanumeric, 8 characters)
INSERT INTO invite_codes (code, created_at)
SELECT 
    upper(substr(md5(random()::text), 1, 8)) as code,
    NOW() as created_at
FROM generate_series(1, 10); -- Creates 10 random codes

-- Method 4: Generate codes with a prefix
INSERT INTO invite_codes (code, created_at)
SELECT 
    'RAD-' || upper(substr(md5(random()::text), 1, 6)) as code,
    NOW() as created_at
FROM generate_series(1, 5); -- Creates 5 codes like RAD-A1B2C3

-- Method 5: Generate time-based codes (includes month/year)
INSERT INTO invite_codes (code, created_at)
SELECT 
    'DEC24-' || upper(substr(md5(random()::text), 1, 6)) as code,
    NOW() as created_at
FROM generate_series(1, 5); -- Creates 5 codes like DEC24-ABC123

-- ============================================
-- USEFUL QUERIES FOR MANAGING INVITE CODES
-- ============================================

-- View all unused invite codes
SELECT code, created_at 
FROM invite_codes 
WHERE used_by IS NULL 
ORDER BY created_at DESC;

-- View all used invite codes with user details
SELECT 
    code,
    email,
    first_name,
    last_name,
    used_at,
    created_at
FROM invite_codes 
WHERE used_by IS NOT NULL 
ORDER BY used_at DESC;

-- Count available vs used codes
SELECT 
    CASE 
        WHEN used_by IS NULL THEN 'Available'
        ELSE 'Used'
    END as status,
    COUNT(*) as count
FROM invite_codes
GROUP BY status;

-- Delete unused codes older than 30 days
DELETE FROM invite_codes 
WHERE used_by IS NULL 
  AND created_at < NOW() - INTERVAL '30 days';

-- Check if a specific code exists and is available
SELECT 
    code,
    CASE 
        WHEN used_by IS NULL THEN 'Available'
        ELSE 'Already Used'
    END as status
FROM invite_codes 
WHERE code = 'YOUR_CODE_HERE';

-- ============================================
-- ADVANCED: CREATE A FUNCTION TO GENERATE CODES
-- ============================================

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_codes(
    num_codes INTEGER DEFAULT 1,
    prefix TEXT DEFAULT '',
    code_length INTEGER DEFAULT 8
)
RETURNS TABLE(code TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE
    generated_code TEXT;
    attempts INTEGER;
BEGIN
    FOR i IN 1..num_codes LOOP
        attempts := 0;
        LOOP
            -- Generate a random code
            generated_code := prefix || upper(substr(md5(random()::text || clock_timestamp()::text), 1, code_length));
            
            -- Check if code already exists
            IF NOT EXISTS (SELECT 1 FROM invite_codes ic WHERE ic.code = generated_code) THEN
                -- Insert the code
                INSERT INTO invite_codes (code, created_at)
                VALUES (generated_code, NOW());
                
                -- Return the generated code
                code := generated_code;
                created_at := NOW();
                RETURN NEXT;
                EXIT; -- Exit the loop for this code
            END IF;
            
            attempts := attempts + 1;
            -- Prevent infinite loop
            IF attempts > 100 THEN
                RAISE EXCEPTION 'Could not generate unique code after 100 attempts';
            END IF;
        END LOOP;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Use the function to generate codes
-- Generate 5 codes with no prefix
SELECT * FROM generate_invite_codes(5);

-- Generate 10 codes with 'VIP-' prefix
SELECT * FROM generate_invite_codes(10, 'VIP-', 6);

-- Generate 3 codes with 'BETA2024-' prefix, 4 character random part
SELECT * FROM generate_invite_codes(3, 'BETA2024-', 4);

-- ============================================
-- ADMIN VIEW: Complete invite code dashboard
-- ============================================

-- Create a comprehensive admin view
CREATE OR REPLACE VIEW invite_codes_dashboard AS
WITH code_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE used_by IS NULL) as available_count,
        COUNT(*) FILTER (WHERE used_by IS NOT NULL) as used_count,
        COUNT(*) as total_count,
        MIN(created_at) FILTER (WHERE used_by IS NULL) as oldest_available,
        MAX(used_at) as last_used
    FROM invite_codes
)
SELECT 
    cs.available_count,
    cs.used_count,
    cs.total_count,
    cs.oldest_available,
    cs.last_used,
    ROUND(100.0 * cs.used_count / NULLIF(cs.total_count, 0), 2) as usage_percentage
FROM code_stats cs;

-- View the dashboard
SELECT * FROM invite_codes_dashboard;

-- ============================================
-- EXAMPLES FOR YOUR USE CASE
-- ============================================

-- Create a batch of December 2024 invite codes
INSERT INTO invite_codes (code, created_at)
SELECT 
    'DEC24-' || upper(substr(md5(random()::text || i::text), 1, 6)) as code,
    NOW() as created_at
FROM generate_series(1, 20) as i; -- Creates 20 codes

-- Create premium/VIP codes
INSERT INTO invite_codes (code, created_at)
VALUES 
    ('VIP-RADPAL-001', NOW()),
    ('VIP-RADPAL-002', NOW()),
    ('VIP-RADPAL-003', NOW());

-- Create simple memorable codes
INSERT INTO invite_codes (code, created_at)
VALUES 
    ('RADIOLOGY2024', NOW()),
    ('MEDICAL2024', NOW()),
    ('DOCTOR2024', NOW()),
    ('HEALTH2024', NOW()),
    ('IMAGING2024', NOW());