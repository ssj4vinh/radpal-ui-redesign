// Chat sessions using IPC to bypass TLS inspection
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
    // Validate required fields
    if (!reportId?.trim()) {
      throw new Error('report_id is required and cannot be empty')
    }

    console.log('🔐 Creating session via IPC with:', {
      reportId: reportId,
      studyType: studyType || 'null',
      reportSnapshot: reportSnapshot ? `${reportSnapshot.substring(0, 50)}...` : 'null'
    })

    // Use IPC to create session
    const result = await window.electron?.ipcRenderer?.invoke('chat-create-session', reportId, studyType, reportSnapshot)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    console.log('✅ Session created successfully via IPC:', result.data?.id)
    return { data: result.data, error: null }
  } catch (error) {
    console.error('❌ createSession failed:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

export async function getSession(sessionId: string): Promise<{ data: ChatSession | null; error: Error | null }> {
  try {
    if (!sessionId?.trim()) {
      throw new Error('session_id is required')
    }

    console.log('📖 Getting session via IPC:', sessionId)

    // Use IPC to get session
    const result = await window.electron?.ipcRenderer?.invoke('chat-get-session', sessionId)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    return { data: result.data, error: null }
  } catch (error) {
    console.error('❌ getSession failed:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

export async function appendMessage(
  sessionId: string, 
  message: any
): Promise<{ data: ChatSession | null; error: Error | null }> {
  try {
    if (!sessionId?.trim()) {
      throw new Error('session_id is required')
    }

    if (!message) {
      throw new Error('message is required')
    }

    console.log('💬 Appending message via IPC to session:', sessionId)

    // Use IPC to append message
    const result = await window.electron?.ipcRenderer?.invoke('chat-append-message', sessionId, message)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    return { data: result.data, error: null }
  } catch (error) {
    console.error('❌ appendMessage failed:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}

export async function getUserSessions(limit: number = 10): Promise<{ data: ChatSession[] | null; error: Error | null }> {
  try {
    console.log('📋 Getting user sessions via IPC, limit:', limit)

    // Use IPC to get user sessions
    const result = await window.electron?.ipcRenderer?.invoke('chat-get-user-sessions', limit)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    return { data: result.data || [], error: null }
  } catch (error) {
    console.error('❌ getUserSessions failed:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error occurred')
    }
  }
}