// AI Proxy Service - Routes all AI calls through your secure backend
import { supabase } from '../supabase/supabaseClient'

const PROXY_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:54321/functions/v1/ai-proxy'
  : 'https://ynzikfmpzhtohwsfniqv.supabase.co/functions/v1/ai-proxy'

interface ProxyRequest {
  service: 'openai' | 'anthropic' | 'deepgram'
  [key: string]: any
}

class AIProxyService {
  private async makeRequest(payload: ProxyRequest) {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Authentication required')
    }

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'API request failed')
    }

    return response.json()
  }

  // OpenAI Chat Completion
  async chatCompletion(messages: any[], model = 'gpt-4o') {
    return this.makeRequest({
      service: 'openai',
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4000
    })
  }

  // Anthropic Claude
  async claudeCompletion(messages: any[], model = 'claude-3-5-sonnet-20241022') {
    return this.makeRequest({
      service: 'anthropic',
      model,
      messages,
      max_tokens: 4000
    })
  }

  // Deepgram Transcription
  async deepgramTranscribe(audioData: ArrayBuffer) {
    // For Deepgram, you might need a different approach
    // Consider WebSocket proxy or presigned URLs
    return this.makeRequest({
      service: 'deepgram',
      // Implementation depends on your needs
    })
  }
}

export const aiProxy = new AIProxyService()

// Migration helper - replace direct API calls
export function migrateToProxy() {
  // Override window.electronAPI calls
  if (window.electronAPI) {
    const originalInvoke = window.electronAPI.invoke
    
    window.electronAPI.invoke = async (channel: string, ...args: any[]) => {
      // Intercept AI-related calls
      if (channel === 'generate-impression' || channel === 'generate-report') {
        // Route through proxy instead
        const [studyType, findings, options] = args
        return aiProxy.chatCompletion([
          { role: 'system', content: 'You are a radiologist...' },
          { role: 'user', content: findings }
        ])
      }
      
      // Let other calls pass through
      return originalInvoke(channel, ...args)
    }
  }
}