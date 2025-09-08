// Remove direct supabase import - will use IPC instead

export interface ChatSession {
  id: string
  user_id: string
  report_id: string
  study_type: string | null
  report_snapshot: string | null
  messages: any[]
  created_at: string
  updated_at: string
}

export async function createSession(
  reportId: string,
  studyType?: string,
  reportSnapshot?: string
): Promise<{ data: ChatSession | null; error: Error | null }> {
  try {
    // Log Supabase configuration
    console.log('🔧 Supabase config check:', {
      supabaseUrl: supabase.supabaseUrl,
      supabaseKey: supabase.supabaseKey ? supabase.supabaseKey.substring(0, 20) + '...' : 'missing'
    })

    // Validate required fields
    if (!reportId?.trim()) {
      throw new Error('report_id is required and cannot be empty')
    }

    console.log('🔍 Creating chat session with params:', {
      reportId: reportId?.trim(),
      studyType: studyType?.trim() || null,
      reportSnapshot: reportSnapshot?.length || 0
    })

    // Get the current authenticated user and session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    console.log('🔐 Auth check:', { 
      userId: user?.id || 'null',
      userIdType: typeof user?.id,
      userIdLength: user?.id?.length || 0,
      session: session?.access_token ? 'present' : 'missing',
      authError: authError?.message || 'none',
      sessionError: sessionError?.message || 'none'
    })
    
    if (authError) {
      throw new Error(`Authentication error: ${authError.message}`)
    }
    if (!user?.id) {
      throw new Error('No authenticated user found')
    }

    // Prepare minimal insert payload with only core columns
    const insertPayload = {
      user_id: user.id,
      report_id: reportId.trim()
      // Excluding optional columns until we know they exist:
      // study_type: studyType?.trim() || null,
      // report_snapshot: reportSnapshot?.trim() || null,
      // messages: [] 
    }

    console.log('📤 Insert payload:', insertPayload)

    // Log clear instructions if table doesn't exist
    console.warn('⚠️ The chat_sessions table exists but is missing columns.')
    console.warn('📋 Add missing columns in Supabase Dashboard > SQL Editor with:')
    console.warn(`
      -- Add all missing columns to existing table
      ALTER TABLE chat_sessions 
      ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS report_snapshot TEXT,
      ADD COLUMN IF NOT EXISTS study_type TEXT,
      ADD COLUMN IF NOT EXISTS report_id UUID;
    `)

    // Test if we can query the table at all with different approaches
    console.log('🧪 Starting table access tests...')
    
    // Test 0: Check what columns actually exist
    const { data: schemaTest, error: schemaError } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(0)
    
    console.log('🔍 Schema inspection:', {
      success: !schemaError,
      error: schemaError ? {
        code: schemaError.code,
        message: schemaError.message,
        details: schemaError.details
      } : null
    })
    
    // Test 1: Simple select
    const { data: test1, error: error1 } = await supabase
      .from('chat_sessions')
      .select('id')
      .limit(1)
    
    console.log('🧪 Test 1 - Simple select:', { 
      success: !error1,
      errorMessage: error1?.message || 'none',
      errorCode: error1?.code || 'none',
      errorDetails: error1?.details || 'none',
      errorHint: error1?.hint || 'none'
    })
    
    if (error1) {
      console.error('🧪 Test 1 Raw Error:', error1)
      console.error('🧪 Test 1 Error String:', String(error1))
      console.error('🧪 Test 1 Error Keys:', Object.getOwnPropertyNames(error1))
    }

    // Test 2: Check if we have any permissions at all
    const { data: test2, error: error2 } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user?.id || 'fake-id')
      .limit(0)
    
    console.log('🧪 Test 2 - Permission check:', { 
      success: !error2,
      errorMessage: error2?.message || 'none',
      errorCode: error2?.code || 'none',
      errorDetails: error2?.details || 'none',
      errorHint: error2?.hint || 'none'
    })
    
    if (error2) {
      console.error('🧪 Test 2 Raw Error:', error2)
      console.error('🧪 Test 2 Error String:', String(error2))
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase insert error details:')
      console.error('   Code:', error?.code || 'none')
      console.error('   Message:', error?.message || 'none')
      console.error('   Details:', error?.details || 'none')
      console.error('   Hint:', error?.hint || 'none')
      console.error('   Payload:', insertPayload)
      console.error('   Raw Error:', error)
      console.error('   Error String:', String(error))
      console.error('   Error Properties:', Object.getOwnPropertyNames(error))
      throw error
    }

    console.log('✅ Chat session created successfully:', data?.id)
    return { data, error: null }
  } catch (error) {
    console.error('💥 Error creating chat session:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: JSON.stringify(error, null, 2)
    })
    return { data: null, error: error as Error }
  }
}

export async function getSession(
  sessionId: string
): Promise<{ data: ChatSession | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching chat session:', error)
    return { data: null, error: error as Error }
  }
}

export async function appendMessage(
  sessionId: string,
  message: { role: string; content: string; timestamp?: Date }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // First get the current session
    const { data: session, error: fetchError } = await getSession(sessionId)
    if (fetchError || !session) throw fetchError || new Error('Session not found')

    // Append the new message
    const updatedMessages = [...(session.messages || []), message]

    // Update the session
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) throw updateError
    return { success: true, error: null }
  } catch (error) {
    console.error('Error appending message:', error)
    return { success: false, error: error as Error }
  }
}

export async function getUserSessions(
  studyType?: string
): Promise<{ data: ChatSession[] | null; error: Error | null }> {
  try {
    // Get the current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('User not authenticated')
    }

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (studyType) {
      query = query.eq('study_type', studyType)
    }

    const { data, error } = await query

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching user sessions:', error)
    return { data: null, error: error as Error }
  }
}