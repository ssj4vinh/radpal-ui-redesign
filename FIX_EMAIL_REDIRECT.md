# Fix Email Confirmation Redirect

## Current Issue
The email confirmation link redirects to `http://localhost:3000` which doesn't exist for your Electron app.

## Solution Options

### Option 1: Use Supabase Default Page (Quickest)
No action needed - the code has been updated to redirect to your Supabase URL, which will show a default success page.

### Option 2: Host a Custom Success Page (Recommended)
1. Host the `public/email-confirmed.html` file on your website
2. Update the redirect URL in Supabase Dashboard:
   - Go to **Authentication → URL Configuration**
   - Set **Site URL** to: `https://radpal.ai/email-confirmed`
   - Add to **Redirect URLs** whitelist:
     ```
     https://radpal.ai/email-confirmed
     https://radpal.ai
     ```

3. Update the code to use your custom page:
   ```javascript
   // In supabasebridge.js
   const emailRedirectTo = 'https://radpal.ai/email-confirmed'
   ```

### Option 3: Deep Link to Electron App (Advanced)
For direct app opening after confirmation:

1. Register a custom protocol handler in your Electron app (in main.js):
   ```javascript
   // Register protocol for deep linking
   if (process.defaultApp) {
     if (process.argv.length >= 2) {
       app.setAsDefaultProtocolClient('radpal', process.execPath, [path.resolve(process.argv[1])])
     }
   } else {
     app.setAsDefaultProtocolClient('radpal')
   }
   
   // Handle the protocol
   app.on('open-url', (event, url) => {
     event.preventDefault()
     // Handle the radpal:// URL
     if (url.includes('email-confirmed')) {
       // Show success message in app
       mainWindow.webContents.send('email-confirmed')
     }
   })
   ```

2. In Supabase, set redirect to: `radpal://email-confirmed`

## Quick Fix for Now

In your Supabase Dashboard:
1. Go to **Authentication → URL Configuration**
2. Remove `http://localhost:3000` from Redirect URLs
3. Either:
   - Leave it empty (will use Supabase default page)
   - Add `https://radpal.ai` if you have a website
   - Add your Supabase project URL

The code has been updated to not specify localhost:3000, so new signups will get a better redirect experience.

## Testing
1. Create a new test account
2. Click the confirmation link in the email
3. You should see either:
   - Supabase's default "Email Confirmed" page
   - Your custom success page (if hosted)
   - The app opening directly (if deep linking is set up)

## User Instructions After Confirmation
Let users know in the confirmation success page:
- "Your email has been confirmed!"
- "Please open RadPal and log in with your credentials"
- "You can close this browser window"