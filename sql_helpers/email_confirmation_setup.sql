-- ============================================
-- EMAIL CONFIRMATION SETUP FOR RADPAL
-- ============================================

-- Step 1: Create a function to handle post-confirmation actions
CREATE OR REPLACE FUNCTION handle_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if email was just confirmed (email_confirmed_at changed from null)
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Log the confirmation
    RAISE NOTICE 'Email confirmed for user: %', NEW.id;
    
    -- Trigger template copy by inserting a record into a queue table
    -- (The actual template copy will be handled by the app when it detects this)
    INSERT INTO template_copy_queue (user_id, created_at, status)
    VALUES (NEW.id, NOW(), 'pending')
    ON CONFLICT (user_id) DO UPDATE
    SET created_at = NOW(), status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the queue table for template copying
CREATE TABLE IF NOT EXISTS template_copy_queue (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT
);

-- Enable RLS on the queue table
ALTER TABLE template_copy_queue ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to manage the queue
CREATE POLICY "Service role manages template queue"
ON template_copy_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 3: Create trigger on auth.users table for email confirmation
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION handle_email_confirmation();

-- Step 4: Configure email templates in Supabase Dashboard
-- Go to Authentication > Email Templates and customize:

-- SIGNUP CONFIRMATION EMAIL TEMPLATE:
/*
Subject: Confirm your RadPal account

Body:
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { 
      display: inline-block; 
      padding: 12px 24px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: bold;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to RadPal!</h1>
    </div>
    
    <p>Hi {{ .Email }},</p>
    
    <p>Thanks for signing up! Please confirm your email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Address</a>
    </div>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #667eea;">{{ .ConfirmationURL }}</p>
    
    <p>This link will expire in 24 hours.</p>
    
    <div class="footer">
      <p>If you didn't create an account with RadPal, you can safely ignore this email.</p>
      <p>© 2024 RadPal. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
*/

-- Step 5: Update Supabase Auth Settings
-- In Supabase Dashboard go to Authentication > Settings:
-- 1. Enable "Email Confirmations" under Email Auth
-- 2. Set Site URL to your app URL (for redirect after confirmation)
-- 3. Add your domain to "Redirect URLs" whitelist

-- Step 6: Configure SMTP Settings (already done)
-- Authentication > Settings > SMTP Settings
-- Sender email: noreply@radpal.ai
-- Sender name: RadPal

-- Step 7: Test email configuration
-- You can test by creating a test user:
/*
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NULL, -- Not confirmed yet
  NOW(),
  NOW()
);
*/

-- Step 8: Monitor the template copy queue
SELECT 
  u.email,
  tcq.status,
  tcq.created_at,
  tcq.processed_at,
  tcq.error_message
FROM template_copy_queue tcq
JOIN auth.users u ON u.id = tcq.user_id
ORDER BY tcq.created_at DESC;

-- Step 9: Manual cleanup of old queue entries (optional)
DELETE FROM template_copy_queue 
WHERE status = 'completed' 
AND processed_at < NOW() - INTERVAL '30 days';

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Email confirmation requires SMTP to be properly configured
-- 2. The redirect URL after confirmation should point to your app
-- 3. Templates are copied when email is confirmed via the queue
-- 4. Monitor the template_copy_queue table for any issues
-- 5. Users can still log in before confirming email if you allow it in settings