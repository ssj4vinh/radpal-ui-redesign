# RadPal Wide Distribution Plan

## Overview
To distribute RadPal to thousands of users publicly, you need to transform it from a personal tool to a commercial SaaS product. Here's the complete roadmap:

## 1. Backend Infrastructure (CRITICAL)

### API Proxy Server
**Why:** Protect API keys and control costs
**Implementation Time:** 1-2 weeks

```javascript
// Supabase Edge Function example
// supabase/functions/ai-proxy/index.ts
import { createClient } from '@supabase/supabase-js'

export async function handleAIRequest(req: Request) {
  // 1. Authenticate user
  const token = req.headers.get('Authorization')
  const { data: user } = await supabase.auth.getUser(token)
  
  // 2. Check subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  if (!subscription || subscription.status !== 'active') {
    return new Response('Subscription required', { status: 402 })
  }
  
  // 3. Check usage limits
  const { count } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 30*24*60*60*1000))
  
  if (count >= subscription.monthly_limit) {
    return new Response('Monthly limit exceeded', { status: 429 })
  }
  
  // 4. Make API call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    method: 'POST',
    body: req.body
  })
  
  // 5. Log usage
  await supabase.from('usage_logs').insert({
    user_id: user.id,
    tokens: response.usage.total_tokens,
    model: req.body.model
  })
  
  return response
}
```

### Database Schema Updates
```sql
-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  plan_name TEXT NOT NULL, -- 'free', 'professional', 'enterprise'
  status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
  monthly_limit INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  model TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  cost_cents INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- License keys (if using license model)
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  plan_name TEXT NOT NULL,
  activated_at TIMESTAMP,
  expires_at TIMESTAMP,
  max_activations INTEGER DEFAULT 1,
  current_activations INTEGER DEFAULT 0
);
```

## 2. Monetization Strategy

### Option A: Subscription Model (Recommended)
```
Free Tier:       $0/month    - 10 reports/month
Professional:   $49/month    - 500 reports/month  
Enterprise:    $199/month    - Unlimited reports + priority support
```

### Option B: Usage-Based Pricing
```
Pay-as-you-go: $0.10 per report
Volume discounts at 1000+ reports
```

### Payment Integration (Stripe)
```javascript
// Payment processing
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

async function createSubscription(userId, planId) {
  // Create or get customer
  const customer = await stripe.customers.create({
    metadata: { user_id: userId }
  })
  
  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: planId }],
    trial_period_days: 14
  })
  
  // Save to database
  await supabase.from('subscriptions').insert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    status: 'active'
  })
}
```

## 3. Security Hardening

### Code Signing Certificates
**Windows:** ~$200-500/year
```bash
# Purchase from DigiCert, Sectigo, etc.
signtool sign /a /fd SHA256 /tr http://timestamp.digicert.com RadPal.exe
```

**macOS:** $99/year (Apple Developer Program)
```bash
codesign --deep --force --sign "Developer ID Application: Your Name" RadPal.app
xcrun notarytool submit RadPal.dmg --apple-id your@email.com
```

### Application Updates
```javascript
// Auto-updater configuration
const { autoUpdater } = require('electron-updater')

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-github',
  repo: 'radpal-releases',
  private: true,
  token: process.env.GITHUB_TOKEN
})

autoUpdater.checkForUpdatesAndNotify()
```

## 4. Legal Requirements

### Terms of Service
Must include:
- API usage limitations
- Liability disclaimers for medical advice
- Intellectual property rights
- Termination conditions

### Privacy Policy (REQUIRED)
- HIPAA compliance statement
- Data processing details
- Third-party services (OpenAI, Anthropic)
- Data retention policies
- User rights (GDPR, CCPA)

### Medical Disclaimer
```
"RadPal is a productivity tool for healthcare professionals. 
It does not provide medical advice. All reports must be reviewed 
and approved by qualified medical professionals before use."
```

### Business Structure
- Form LLC or Corporation
- Get business insurance (E&O, Cyber liability)
- Register trademarks

## 5. HIPAA Compliance

### Required for Healthcare Software:
1. **Business Associate Agreements (BAAs)**
   - Need BAA with OpenAI (Enterprise only)
   - Supabase offers BAA on Pro plan
   - Consider HIPAA-compliant alternatives

2. **Technical Safeguards**
```javascript
// PHI anonymization before sending to AI
function anonymizePHI(text) {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // SSN
    .replace(/\b\d{10}\b/g, '[MRN]') // MRN
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '[DATE]') // Dates
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]') // Names
}
```

3. **Audit Logging**
```javascript
// Log all PHI access
async function logPHIAccess(userId, action, patientId) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: action,
    patient_id: patientId,
    timestamp: new Date(),
    ip_address: req.ip
  })
}
```

## 6. Infrastructure & DevOps

### Hosting Requirements
- **API Proxy:** Vercel, Supabase Edge, AWS Lambda
- **Database:** Supabase (Pro plan for BAA)
- **File Storage:** AWS S3 with encryption
- **CDN:** CloudFlare for updates

### Monitoring & Analytics
```javascript
// Error tracking with Sentry
const Sentry = require('@sentry/electron')
Sentry.init({ 
  dsn: 'your-sentry-dsn',
  environment: 'production'
})

// Usage analytics
const analytics = require('electron-google-analytics')
analytics.event('Report', 'Generated', reportType)
```

## 7. Implementation Timeline

### Phase 1: Core Infrastructure (Weeks 1-2)
- [ ] Set up Supabase Edge Functions
- [ ] Implement API proxy
- [ ] Create subscription database schema
- [ ] Basic usage tracking

### Phase 2: Monetization (Weeks 3-4)
- [ ] Stripe integration
- [ ] Subscription management UI
- [ ] License key system
- [ ] Payment webhook handlers

### Phase 3: Security & Compliance (Weeks 5-6)
- [ ] Code signing setup
- [ ] Auto-updater implementation
- [ ] PHI anonymization
- [ ] Audit logging

### Phase 4: Legal & Business (Weeks 7-8)
- [ ] Draft Terms of Service
- [ ] Create Privacy Policy
- [ ] Form business entity
- [ ] Obtain insurance

### Phase 5: Testing & Launch (Weeks 9-10)
- [ ] Beta testing with 50 users
- [ ] Load testing API proxy
- [ ] Security audit
- [ ] Marketing website

## 8. Cost Estimates

### Development Costs
- Backend development: $5,000-15,000
- Legal documents: $2,000-5,000
- Security audit: $3,000-10,000
- **Total: $10,000-30,000**

### Ongoing Monthly Costs
- Supabase Pro: $25/month
- Vercel/AWS: $100-500/month
- Code signing: $40/month
- Insurance: $200-500/month
- **Total: $365-1,065/month**

### API Costs (Variable)
- OpenAI: ~$0.01-0.03 per report
- Anthropic: ~$0.01-0.02 per report
- At 10,000 reports/month: $100-300

## 9. Quick Start Checklist

### Minimum Viable Product for Wide Distribution:
1. **Week 1:** Set up API proxy on Supabase
2. **Week 2:** Add basic usage tracking
3. **Week 3:** Implement free/paid tiers
4. **Week 4:** Add Terms & Privacy Policy
5. **Week 5:** Code sign the application
6. **Week 6:** Beta test with 100 users

### Essential Features Before Launch:
- [x] API key protection (proxy server)
- [ ] User authentication
- [ ] Usage limits
- [ ] Payment processing
- [ ] Auto-updates
- [ ] Error reporting
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Code signing

## 10. Alternative: Managed Service Providers

If this seems overwhelming, consider:

### 1. **Tauri + Cloudflare Workers**
- More secure than Electron
- Built-in API proxy support
- Lower resource usage

### 2. **Microsoft Azure Healthcare**
- HIPAA compliant by default
- Built-in AI services
- Higher cost but less liability

### 3. **Partner with Existing EMR**
- Integrate as plugin
- They handle compliance
- Revenue sharing model

## Summary

**Minimum Investment:** $10,000-15,000
**Time to Market:** 8-10 weeks
**Monthly Operating Cost:** $500-1,000
**Break-even:** ~20-30 paying customers

**Critical Path:**
1. API Proxy (protect keys) ← **Do this first**
2. Usage limits (control costs)
3. Payment system (generate revenue)
4. Legal compliance (avoid liability)
5. Code signing (user trust)

Without these elements, wide distribution poses significant financial and legal risks. The API proxy alone is essential - without it, your API keys will be compromised within days of public release.