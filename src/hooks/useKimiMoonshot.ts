import { useState } from 'react'

interface KimiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface KimiResponse {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export function useKimiMoonshot() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateWithKimi = async (
    messages: KimiMessage[],
    temperature: number = 0.7
  ): Promise<{ text: string; tokens: { input: number; output: number; total: number } }> => {
    setLoading(true)
    setError(null)

    try {
      const apiKey = process.env.MOONSHOT_API_KEY
      if (!apiKey) {
        throw new Error('MOONSHOT_API_KEY not found in environment variables')
      }

      const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'kimi-k2-0711-preview',
          messages: messages,
          temperature: temperature,
          stream: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error?.message || 
          `Kimi API error: ${response.status} ${response.statusText}`
        )
      }

      const data: KimiResponse = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Kimi API')
      }

      const content = data.choices[0].message.content
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

      return {
        text: content,
        tokens: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Kimi API error:', err)
      
      // Return fallback response
      return {
        text: `❌ Kimi API Error: ${errorMessage}. Please check your API key and try again.`,
        tokens: { input: 0, output: 0, total: 0 }
      }
    } finally {
      setLoading(false)
    }
  }

  return {
    generateWithKimi,
    loading,
    error
  }
}