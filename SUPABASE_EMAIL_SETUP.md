# Supabase Email Confirmation Setup Guide

## Overview
This guide explains how to configure email confirmation for user signup in RadPal using Supabase and your custom domain (noreply@radpal.ai).

## Prerequisites
- [x] SMTP configured in Supabase (already done for noreply@radpal.ai)
- [x] Custom domain verified
- [ ] Email templates configured
- [ ] Auth settings updated

## Step 1: Enable Email Confirmation in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Settings**
3. Under **Email Auth** section:
   - Enable "Email Confirmations"
   - Set "Confirm email" to "Required"

## Step 2: Configure Redirect URLs

1. In **Authentication > URL Configuration**:
   - Set Site URL: `radpal://auth/callback` (or your app's URL)
   - Add to Redirect URLs whitelist:
     - `radpal://auth/callback`
     - `http://localhost:3000` (for development)
     - Your production URL

## Step 3: Customize Email Templates

1. Go to **Authentication > Email Templates**
2. Select "Confirm signup" template
3. Update the template:

### Subject Line:
```
Confirm your RadPal account
```

### Email Body (HTML):
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f9f9f9;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .button { 
      display: inline-block; 
      padding: 14px 28px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      opacity: 0.9;
    }
    .footer { 
      margin-top: 30px; 
      font-size: 12px; 
      color: #666;
      text-align: center;
    }
    .link {
      color: #667eea;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="header">
        <div class="logo">RadPal</div>
      </div>
      
      <p>Hi {{ .Email }},</p>
      
      <p>Welcome to RadPal! We're excited to have you on board.</p>
      
      <p>Please confirm your email address by clicking the button below:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Address</a>
      </div>
      
      <p>Or copy and paste this link into your browser:</p>
      <p class="link">{{ .ConfirmationURL }}</p>
      
      <p><strong>This link will expire in 24 hours.</strong></p>
      
      <p>Once confirmed, you'll be able to log in and start using RadPal's AI-powered radiology reporting tools.</p>
      
      <div class="footer">
        <p>If you didn't create an account with RadPal, you can safely ignore this email.</p>
        <p>© 2024 RadPal. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
```

## Step 4: Run Database Migration

Execute the SQL in `sql_helpers/email_confirmation_setup.sql` to:
- Create the email confirmation trigger
- Set up the template copy queue
- Configure proper policies

```sql
-- Run in Supabase SQL Editor
-- See sql_helpers/email_confirmation_setup.sql for full script
```

## Step 5: Test Email Confirmation Flow

1. Sign up with a test email
2. Check for confirmation email from noreply@radpal.ai
3. Click confirmation link
4. Log in to verify templates are copied

## How It Works

1. **User signs up** → Invite code validated → Profile saved
2. **Confirmation email sent** → User clicks link
3. **Email confirmed** → Database trigger fires
4. **User logs in** → App checks template_copy_queue
5. **Templates copied** → User ready to use app

## Troubleshooting

### Email not sending:
- Check SMTP settings in Supabase
- Verify sender domain (radpal.ai) is properly configured
- Check spam folder

### Templates not copying after confirmation:
- Check `template_copy_queue` table for user's status
- Verify trigger is created on auth.users table
- Check app logs for template copy errors

### User can't log in before confirming:
- This is expected behavior if "Confirm email" is set to "Required"
- Change to "Recommended" if you want to allow login before confirmation

## Security Notes

- Invite codes are marked as used immediately upon signup (before email confirmation)
- User profiles are saved even before confirmation
- Templates are only copied after email is confirmed
- Email confirmation links expire after 24 hours