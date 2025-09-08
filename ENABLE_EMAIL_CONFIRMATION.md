# Enable Email Confirmation in Supabase

## The Issue
Email confirmation is not currently enforced - users can sign up and immediately log in without verifying their email address.

## How to Enable Email Confirmation

### Step 1: Go to Supabase Dashboard
1. Log in to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**

### Step 2: Configure Email Provider Settings
1. Under **Email** provider, click on the settings/configure button
2. Find the **"Confirm email"** setting
3. Change it from **"Disabled"** or **"Recommended"** to **"Required"**
   - **Disabled**: Users can log in immediately (current behavior)
   - **Recommended**: Email sent but users can log in without confirming
   - **Required**: Users MUST confirm email before they can log in

### Step 3: Configure Email Templates
1. Go to **Authentication** → **Email Templates**
2. Select **"Confirm signup"** template
3. Ensure the template is properly configured with your branding

### Step 4: Set Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Set the **Site URL** to your app's URL (e.g., `https://radpal.ai` or for Electron app: `radpal://`)
3. Add to **Redirect URLs** (one per line):
   ```
   radpal://auth/callback
   http://localhost:3000
   https://radpal.ai
   ```

### Step 5: Test the Configuration
1. Try signing up with a new email address
2. Check the console logs - you should see:
   ```
   🔍 Sign-up response: {
     hasSession: false,    // ← Should be false
     hasUser: true,        // ← Should be true
     ...
   }
   📧 Email confirmation required for: [email]
   ```
3. The user should receive a confirmation email
4. User should NOT be able to log in until they click the confirmation link

## What Happens When Enabled

### During Signup:
1. User fills out signup form with invite code
2. `supabase.auth.signUp()` creates the user but returns NO session
3. Confirmation email is sent to the user
4. App shows "Please check your email to confirm your account"
5. User profile and invite code usage are saved (but user can't log in yet)

### After Email Confirmation:
1. User clicks the confirmation link in email
2. Supabase confirms the email address
3. Database trigger fires (if you've set up `template_copy_queue`)
4. User can now log in normally
5. On first login after confirmation, templates are copied

## Verification Checklist

- [ ] Email provider shows "Confirm email: Required" in Supabase
- [ ] SMTP settings are configured (already done for noreply@radpal.ai)
- [ ] Email templates are customized
- [ ] Redirect URLs are whitelisted
- [ ] Test signup shows "Email confirmation required" message
- [ ] Confirmation emails are being received
- [ ] Users cannot log in before confirming email
- [ ] Users can log in after confirming email

## Troubleshooting

### If emails aren't sending:
- Check SMTP configuration in Authentication → Settings
- Verify sender domain (radpal.ai)
- Check Supabase email logs

### If users can still log in without confirming:
- Double-check "Confirm email" is set to "Required" not "Recommended"
- Clear browser cache and test with a new email
- Check console logs for the sign-up response

### If confirmation links don't work:
- Verify redirect URLs are properly whitelisted
- Check that Site URL is correctly set
- For Electron apps, custom protocol handlers may need to be registered