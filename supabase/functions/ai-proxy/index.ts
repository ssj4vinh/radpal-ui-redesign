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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify user authentication
    // For initial testing, we'll check for auth but not enforce strict user verification
    const authHeader = req.headers.get('Authorization')
    let userId = 'anonymous'
    
    if (authHeader && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      if (user) {
        userId = user.id
      }
    }
    
    // For production, uncomment this to require authentication:
    // if (!user) {
    //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    //     status: 401,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    //   })
    // }

    // Check daily token limit if user is authenticated
    if (userId !== 'anonymous') {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabaseClient
        .from('usage_logs')
        .select('tokens')
        .eq('user_id', userId)
        .gte('created_at', today)
        .single()

      const dailyLimit = 100000 // Adjust based on your limits
      if (usage && usage.tokens > dailyLimit) {
        return new Response(JSON.stringify({ error: 'Daily limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Parse request
    const { service, ...requestBody } = await req.json()

    let apiUrl: string
    let apiKey: string
    let requestHeaders: any = { 'Content-Type': 'application/json' }

    // Route to appropriate AI service
    switch (service) {
      case 'openai':
        apiUrl = 'https://api.openai.com/v1/chat/completions'
        apiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured in Supabase secrets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        requestHeaders['Authorization'] = `Bearer ${apiKey}`
        break
      
      case 'anthropic':
        apiUrl = 'https://api.anthropic.com/v1/messages'
        apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Supabase secrets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        requestHeaders['x-api-key'] = apiKey
        requestHeaders['anthropic-version'] = '2023-06-01'
        break
      
      case 'deepgram':
        apiUrl = requestBody.url || 'https://api.deepgram.com/v1/listen'
        apiKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''
        requestHeaders['Authorization'] = `Token ${apiKey}`
        break
      
      case 'gemini':
        apiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in Supabase secrets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
        // Gemini uses query param for API key, not headers
        break
      
      case 'kimi':
      case 'moonshot':
        apiUrl = 'https://api.moonshot.ai/v1/chat/completions'
        apiKey = Deno.env.get('MOONSHOT_API_KEY') ?? ''
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'MOONSHOT_API_KEY not configured in Supabase secrets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        requestHeaders['Authorization'] = `Bearer ${apiKey}`
        break
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid service' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Make the API call
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    // Log usage (if response includes token count and user is authenticated)
    if (data.usage?.total_tokens && userId !== 'anonymous') {
      const today = new Date().toISOString().split('T')[0]
      await supabaseClient
        .from('usage_logs')
        .upsert({
          user_id: userId,
          date: today,
          tokens: data.usage.total_tokens,
          requests: 1
        })
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})