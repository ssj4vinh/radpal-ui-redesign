// Test script for API Proxy
const fetch = require('node-fetch');

// Your Supabase project details
const SUPABASE_URL = 'https://ynzikfmpzhtohwsfniqv.supabase.co';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;

// You need a valid Supabase user token to test
// Get this from your app after logging in, or use the service key temporarily
async function testProxy() {
  console.log('🧪 Testing RadPal API Proxy...\n');
  
  // First, get an auth token (you'll need to login first)
  // For testing, you can use your service role key temporarily
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc';
  
  console.log('Testing OpenAI proxy...');
  
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY
      },
      body: JSON.stringify({
        service: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from RadPal Proxy!" if you can hear me.'
          }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success! Response from OpenAI:');
      console.log(data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', data.error || data);
      console.log('\nPossible issues:');
      console.log('1. API keys not set in Supabase secrets');
      console.log('2. Authentication required (need valid user token)');
      console.log('3. Function needs --no-verify-jwt flag');
    }
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    console.log('\nMake sure:');
    console.log('1. Function is deployed: supabase functions deploy ai-proxy');
    console.log('2. Secrets are set: supabase secrets set OPENAI_API_KEY="your-key"');
  }
  
  console.log('\n📍 Function URL:', PROXY_URL);
  console.log('📊 Dashboard:', `${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/functions`);
}

testProxy();