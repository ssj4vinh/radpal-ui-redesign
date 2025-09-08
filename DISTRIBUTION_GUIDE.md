# RadPal Distribution Guide

## Distribution Options Without Requiring User API Keys

### Current Implementation: Embedded Keys (Obfuscated)
Your app now embeds API keys in an obfuscated form during build time.

**How it works:**
1. Keys are loaded from `.env.backup` during build
2. Keys are encrypted with AES-256 (basic obfuscation)
3. Encrypted keys are embedded in `electron/.keys`
4. App decrypts keys at runtime

**Security Level:** ⚠️ **MEDIUM**
- Prevents casual inspection of keys
- Determined users CAN extract keys with effort
- Keys are shared across all users

**Build Process:**
```bash
# Restore your API keys to .env.backup (one time)
# Then build normally:
npm run dist
```

### Recommended: Server-Side Proxy (Most Secure)
For production distribution, implement a backend API proxy:

**Architecture:**
```
User App → Your Server (with keys) → OpenAI/Anthropic APIs
```

**Benefits:**
- API keys never leave your server
- Add usage limits per user
- Track usage and costs
- Implement subscription tiers
- Revoke access if needed

**Quick Implementation with Supabase Edge Functions:**
```javascript
// supabase/functions/ai-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { model, messages } = await req.json()
  
  // Verify user authentication
  const authHeader = req.headers.get('Authorization')
  // Check user quota/subscription
  
  // Proxy to OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages })
  })
  
  return response
})
```

### Alternative: License Key System
Implement a license key system where users purchase keys from you:

1. User purchases license from your website
2. You generate a unique license key
3. License key unlocks AI features in the app
4. Your server validates license and provides API access

### Cost Management Strategies

**Option 1: Free Tier with Limits**
- Offer X free reports per month
- Require subscription for unlimited use

**Option 2: Bring Your Own Key (Optional)**
- Default to your embedded keys
- Allow power users to add their own keys
- Implement in Settings:
```javascript
// Add toggle in settings
[ ] Use custom API keys (advanced users)
```

**Option 3: Local AI Fallback**
- Use embedded keys for premium models
- Offer local llama.cpp as free alternative
- Already partially implemented in your app

## Immediate Distribution Path

With your current setup, you can distribute the app:

1. **Ensure keys are in `.env.backup`**
2. **Build the app:** `npm run dist`
3. **Test the installer** to ensure keys work
4. **Consider adding:**
   - Usage disclaimer about AI costs
   - Rate limiting to prevent abuse
   - Error handling if APIs fail

## Legal Considerations

When distributing with embedded API keys:

1. **Terms of Service:** Clearly state:
   - AI features may be limited or disabled
   - You reserve the right to update API access
   - Users must not attempt to extract API keys

2. **Privacy Policy:** Disclose:
   - Patient data is processed by third-party AI services
   - Data is not stored on your servers
   - Users should anonymize sensitive information

3. **API Provider Terms:**
   - Check OpenAI/Anthropic terms for shared key usage
   - Consider enterprise agreements for redistribution

## Monitoring & Protection

Add telemetry to track usage:
```javascript
// Track API usage
async function trackUsage(userId, model, tokens) {
  await supabase
    .from('usage_logs')
    .insert({ user_id: userId, model, tokens, timestamp: new Date() })
}
```

Implement rate limiting:
```javascript
const userRequests = new Map()

function checkRateLimit(userId) {
  const requests = userRequests.get(userId) || []
  const recentRequests = requests.filter(t => Date.now() - t < 60000)
  
  if (recentRequests.length > 10) {
    throw new Error('Rate limit exceeded')
  }
  
  userRequests.set(userId, [...recentRequests, Date.now()])
}
```

## Summary

Your app is now configured to:
- ✅ Embed obfuscated API keys in builds
- ✅ Work without requiring user API keys
- ⚠️ Has medium security (keys can be extracted)

For production, strongly consider:
- Setting up a proxy server
- Implementing usage limits
- Adding subscription management

The current solution allows immediate distribution while you develop a more robust backend solution.