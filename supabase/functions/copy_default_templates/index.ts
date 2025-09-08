import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js'



serve(async (req) => {
  console.log('🧪 THIS IS THE NEW DEPLOYED VERSION')

  const expectedSecret = Deno.env.get('HOOK_SECRET')?.trim()
  const receivedSecret = req.headers.get('x-hook-secret')?.trim()

  console.log('💬 Received secret:', receivedSecret)
  console.log('💬 Expected secret:', expectedSecret)

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    console.error('❌ Invalid hook secret')
    return new Response(JSON.stringify({ code: 401, message: 'Unauthorized' }), { status: 401 })
  }

  console.log('✅ Secret validated')

  try {
    console.log('✅ Reached copy_default_templates')

    const { user } = await req.json()
    if (!user?.id) {
      console.error('❌ Missing user in payload')
      return new Response('Missing user ID', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: defaults, error: fetchError } = await supabase
      .from('default_templates')
      .select('*')

    if (fetchError || !defaults) {
      console.error('❌ Failed to fetch default templates:', fetchError)
      return new Response('Error fetching defaults', { status: 500 })
    }

    console.log(`📦 Copying ${defaults.length} templates for user: ${user.id}`)

    const inserts = defaults.map((t) => ({
      user_id: user.id,
      study_type: t.study_type,
      template: t.template,
      generate_prompt: t.generate_prompt,
      generate_impression: t.generate_impression,
      updated_at: new Date().toISOString()
    }))

    const { error: insertError } = await supabase
      .from('templates')
      .insert(inserts)

    if (insertError) {
      console.error('❌ Failed to insert templates:', insertError)
      return new Response('Error inserting templates', { status: 500 })
    }

    return new Response('✅ Templates copied successfully', { status: 200 })
  } catch (err) {
    console.error('🔥 Unexpected error:', err)
    return new Response('Unexpected server error', { status: 500 })
  }
})
