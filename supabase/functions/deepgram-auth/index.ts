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

    // Parse request
    const { action, minutes } = await req.json()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const today = new Date().toISOString().split('T')[0]
    const userId = user.id

    if (action === 'check') {
      // Check if user can use dictation
      const { data: usage } = await supabaseClient
        .from('dictation_usage')
        .select('minutes_used')
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      // Get user's tier for limits
      const { data: subscription } = await supabaseClient
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .single()

      // Set limits based on tier
      const limits = {
        1: 0,     // Basic: No dictation access
        2: 30,    // Pro: 30 minutes/day
        3: 60,    // Premium: 60 minutes/day
        4: 200,   // Tester: 200 minutes/day (for dataset collection)
        5: 1440   // Developer: 24 hours/day (effectively unlimited)
      }

      const userTier = subscription?.tier || 1
      const dailyLimit = limits[userTier]
      const minutesUsed = usage?.minutes_used || 0
      const canUse = minutesUsed < dailyLimit && dailyLimit > 0

      // Check if tier 1 (no access)
      if (userTier === 1) {
        return new Response(JSON.stringify({ 
          authorized: false,
          error: 'Dictation is not available on the Basic plan. Please upgrade to Pro or higher.',
          tier: userTier,
          dailyLimit: 0
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // If user can use, return the API key
      if (canUse) {
        const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''
        return new Response(JSON.stringify({ 
          authorized: true,
          apiKey: deepgramApiKey,
          minutesUsed,
          minutesRemaining: dailyLimit - minutesUsed,
          dailyLimit
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        return new Response(JSON.stringify({ 
          authorized: false,
          error: 'Daily dictation limit exceeded',
          minutesUsed,
          dailyLimit
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } 
    
    else if (action === 'track') {
      // Track usage after dictation session
      const { data: existing } = await supabaseClient
        .from('dictation_usage')
        .select('minutes_used')
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      const newTotal = (existing?.minutes_used || 0) + (minutes || 0)

      await supabaseClient
        .from('dictation_usage')
        .upsert({
          user_id: userId,
          date: today,
          minutes_used: newTotal,
          updated_at: new Date().toISOString()
        })

      return new Response(JSON.stringify({ 
        success: true,
        totalMinutesUsed: newTotal
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})