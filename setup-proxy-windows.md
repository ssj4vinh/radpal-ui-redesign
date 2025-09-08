# Windows Setup for API Proxy

## Option 1: Install via Scoop (Easiest)

```powershell
# Install scoop if you don't have it
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

## Option 2: Direct Download

```powershell
# Run the provided PowerShell script
.\install-supabase-cli.ps1
```

## Option 3: Manual Installation

1. Download from: https://github.com/supabase/cli/releases
2. Download `supabase_windows_amd64.zip`
3. Extract to `C:\Program Files\supabase\`
4. Add to PATH manually

## Deploy the Proxy

Once Supabase CLI is installed:

```bash
# Login to Supabase
supabase login

# Get your project details from Supabase Dashboard
# Go to: https://app.supabase.com/project/_/settings/general
# Copy the Reference ID (looks like: ynzikfmpzhtohwsfniqv)

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy ai-proxy --no-verify-jwt

# Set your API keys as secrets
supabase secrets set OPENAI_API_KEY=your_key_here
supabase secrets set ANTHROPIC_API_KEY=your_key_here  
supabase secrets set DEEPGRAM_API_KEY=your_key_here
```

## Update Your App

### 1. Create environment variable for proxy URL:

```javascript
// In electron/main.js or config
const PROXY_URL = process.env.SUPABASE_FUNCTION_URL || 
  'https://ynzikfmpzhtohwsfniqv.supabase.co/functions/v1/ai-proxy'
```

### 2. Update API calls:

**OLD (Unsafe):**
```javascript
// In electron/main.js - generateImpression handler
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages
})
```

**NEW (Safe):**
```javascript
// In electron/main.js - generateImpression handler
const { data: session } = await supabase.auth.getSession()

const response = await fetch(PROXY_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    service: 'openai',
    model: 'gpt-4',
    messages: messages
  })
})

const data = await response.json()
```

### 3. Update Deepgram calls:

**OLD:**
```javascript
// In deepgram-dictation.js
const deepgramUrl = `wss://api.deepgram.com/v1/listen?...`
```

**NEW:**
```javascript
// Create a server-side WebSocket proxy or use presigned URLs
// This is more complex - consider keeping Deepgram client-side 
// but rotating keys frequently
```

## Test the Proxy

```bash
# Test with curl (replace with your project URL and a valid JWT)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ai-proxy \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "openai",
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Monitor Usage

Check function logs in Supabase Dashboard:
https://app.supabase.com/project/YOUR_PROJECT/functions/ai-proxy/logs

## Quick Test Checklist

- [ ] Supabase CLI installed
- [ ] Function deployed
- [ ] Secrets set
- [ ] Test with curl
- [ ] Update one API call in app
- [ ] Test in development
- [ ] Check logs for errors
- [ ] Update all API calls
- [ ] Remove embedded keys
- [ ] Build and test production version