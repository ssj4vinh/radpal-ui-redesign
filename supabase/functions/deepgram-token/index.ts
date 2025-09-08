import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get Deepgram API key from environment
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''
    
    if (!deepgramApiKey) {
      return new Response(JSON.stringify({ error: 'Deepgram not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Option 1: Return the API key (simple but less secure)
    // This is similar to current approach but with auth
    return new Response(JSON.stringify({ 
      apiKey: deepgramApiKey,
      // Optionally add expiration time
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    // Option 2: Create a temporary project key using Deepgram API
    // This would require additional Deepgram API setup
    // const tempKey = await createTemporaryDeepgramKey(deepgramApiKey, user.id)
    // return new Response(JSON.stringify({ apiKey: tempKey }), { headers })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})