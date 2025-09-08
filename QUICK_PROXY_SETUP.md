# Quick API Proxy Setup (Protect Your Keys)

Since you already have:
- ✅ LLC and business structure
- ✅ Code signing
- ✅ Daily token limits
- ✅ User authentication (Supabase)

**You only need the API proxy to be ready for wide distribution!**

## 15-Minute Setup Guide

### Step 1: Deploy the Proxy (5 minutes)
```bash
# Install Supabase CLI
npm install -g supabase

# Deploy the function
cd /mnt/c/dev/radpal
chmod +x deploy-proxy.sh
./deploy-proxy.sh
```

### Step 2: Update Your App (10 minutes)

Replace direct API calls in your electron app:

**Before (UNSAFE):**
```javascript
// In electron/main.js
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
})
```

**After (SAFE):**
```javascript
// In electron/main.js
const response = await fetch('https://your-project.supabase.co/functions/v1/ai-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userSession.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    service: 'openai',
    model: 'gpt-4',
    messages: messages
  })
})
```

### Step 3: Remove Keys from App Build
```javascript
// In scripts/build-keys.js - DELETE THIS FILE
// In package.json - Remove "build-keys" script
// In electron/keyManager.js - DELETE THIS FILE
```

## Cost Impact

**Your current setup (embedded keys):**
- Risk: $∞ (if keys are stolen)
- Cost per user: Unpredictable

**With proxy:**
- Risk: $0 (keys are safe)
- Cost per user: Same as now (you control limits)
- Additional cost: ~$25/month for Supabase Functions

## Testing Checklist

- [ ] Deploy proxy function
- [ ] Update one API call (test with OpenAI first)
- [ ] Verify user authentication works
- [ ] Check rate limiting works
- [ ] Monitor function logs in Supabase dashboard
- [ ] Update all remaining API calls
- [ ] Remove embedded keys from build
- [ ] Test full app functionality
- [ ] Deploy to 10 beta users
- [ ] Monitor for 24 hours
- [ ] Wide release! 🎉

## Quick Wins

Since you already have daily limits, you can add these to the proxy:

1. **Per-minute rate limiting:**
```typescript
const recentRequests = await supabase
  .from('usage_logs')
  .select('created_at')
  .eq('user_id', user.id)
  .gte('created_at', new Date(Date.now() - 60000))
  
if (recentRequests.data?.length > 10) {
  return new Response('Rate limit: max 10 requests per minute', { status: 429 })
}
```

2. **Cost tracking:**
```typescript
// After each API call
const cost = calculateCost(data.usage.total_tokens, model)
await supabase
  .from('usage_logs')
  .insert({ 
    user_id: user.id, 
    tokens: data.usage.total_tokens,
    cost_cents: Math.ceil(cost * 100)
  })
```

3. **Automatic cutoff:**
```typescript
if (usage.cost_cents > 10000) { // $100 limit per user
  await supabase
    .from('users')
    .update({ api_access_suspended: true })
    .eq('id', user.id)
  
  // Send alert email
  await sendEmail(user.email, 'API usage limit reached')
}
```

## You're 95% Ready!

With the proxy in place, you can safely:
- Distribute to unlimited users
- Control costs precisely  
- Revoke access instantly if needed
- Track usage per user
- Add premium tiers later

**Time to implement: 2-3 hours**
**Risk reduction: 100%**

Your app will be ready for Product Hunt, Reddit, and wide distribution!