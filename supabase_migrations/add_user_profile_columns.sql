-- Add user profile columns to user_subscriptions table
-- These columns will store user's first name, last name, and email

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email 
ON user_subscriptions(email);

-- Optional: Add a check constraint to ensure email format (basic validation)
-- ALTER TABLE user_subscriptions 
-- ADD CONSTRAINT email_format_check 
-- CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Comment the columns for documentation
COMMENT ON COLUMN user_subscriptions.first_name IS 'User''s first name';
COMMENT ON COLUMN user_subscriptions.last_name IS 'User''s last name';
COMMENT ON COLUMN user_subscriptions.email IS 'User''s email address';