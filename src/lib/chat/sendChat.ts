import { askAISystemPrompt } from '../../../agent/prompts/askAISystemPrompt'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  text: string
  tokens?: number
  error?: string
}

export async function sendChat(
  messages: ChatMessage[],
  apiProvider: string = 'claude-3-sonnet'
): Promise<ChatResponse> {
  try {
    // Ensure we have the system prompt at the beginning
    const hasSystemPrompt = messages.some(m => m.role === 'system' && m.content.includes('helpful radiology AI assistant'))
    
    let finalMessages = messages
    if (!hasSystemPrompt) {
      finalMessages = [
        { role: 'system', content: askAISystemPrompt },
        ...messages
      ]
    }

    // Call the appropriate API based on the provider
    if (window.electronAPI?.sendChatMessage) {
      const response = await window.electronAPI.sendChatMessage({
        messages: finalMessages,
        provider: apiProvider
      })
      
      return {
        text: response.text || response,
        tokens: response.tokens
      }
    } else {
      // Fallback to generateReport API if sendChatMessage is not available
      const response = await window.electronAPI?.generateReport?.(JSON.stringify({
        messages: finalMessages,
        type: 'chat',
        provider: apiProvider
      }))
      
      if (typeof response === 'string') {
        return { text: response }
      } else if (response) {
        return {
          text: response.text || response,
          tokens: response.tokens
        }
      } else {
        throw new Error('No response received from API')
      }
    }
  } catch (error) {
    console.error('Chat API error:', error)
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Failed to send chat message'
    }
  }
}