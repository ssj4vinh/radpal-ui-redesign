interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface AnthropicResponse {
  content: Array<{
    text: string
  }>
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

interface KimiResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// Import Mistral Local resolver
import { resolveMistralLocal } from '../src/providers/MistralLocalResolver'

export interface ModelCallResponse {
  text: string
  tokens?: {
    input: number
    output: number
    total: number
  }
  ruleViolations?: string[]
  ruleWarnings?: string[]
}

export default async function callModel({
  prompt,
  model = "gpt-4"
}: {
  prompt: string
  model?: string
}): Promise<ModelCallResponse> {
  try {
    // Check if we're in browser/Electron renderer process
    if (typeof window !== 'undefined' && window.electronAPI?.generateReport) {
      // Use the existing Electron IPC to call the model
      const response = await window.electronAPI.generateReport(prompt)
      
      // Handle both string and object responses
      if (typeof response === 'string') {
        return {
          text: response,
          tokens: { input: 0, output: 0, total: 0 }
        }
      } else if (response?.text) {
        return {
          text: response.text,
          tokens: response.tokens || { input: 0, output: 0, total: 0 }
        }
      } else {
        throw new Error('Invalid response from model')
      }
    } else {
      // Server-side implementation - call APIs directly
      return await callModelDirect(prompt, model)
    }
  } catch (error) {
    console.error('Error calling model:', error)
    throw error
  }
}

async function callModelDirect(prompt: string, model: string): Promise<ModelCallResponse> {
  // Normalize model names and route to appropriate API
  const normalizedModel = model.toLowerCase()

  if (normalizedModel.includes('gpt') || normalizedModel.includes('openai')) {
    return await callOpenAI(prompt, model)
  } else if (normalizedModel.includes('claude')) {
    return await callAnthropic(prompt, model)
  } else if (normalizedModel.includes('gemini')) {
    return await callGemini(prompt, model)
  } else if (normalizedModel.includes('kimi')) {
    return await callKimi(prompt, model)
  } else if (normalizedModel.includes('mistral-local') || normalizedModel === 'mistral-local') {
    return await callMistralLocal(prompt)
  } else {
    throw new Error(`Unsupported model: ${model}. Supported models: GPT-4, GPT-3.5-Turbo, Claude-3-Sonnet, Claude-3-Opus, Gemini, Kimi, Mistral-Local`)
  }
}

async function callOpenAI(prompt: string, model: string): Promise<ModelCallResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment variables')
  }

  // Map RadPal model names to OpenAI model names
  let openaiModel = 'gpt-4o' // Default to GPT-4o
  if (model.includes('3.5') || model.includes('turbo')) {
    openaiModel = 'gpt-3.5-turbo'
  } else if (model === 'gpt-o3-pro') {
    openaiModel = 'gpt-o3-pro'
  } else if (model === 'gpt-5-mini') {
    openaiModel = 'gpt-5-mini'
  } else if (model === 'gpt-5') {
    openaiModel = 'gpt-5'
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful radiology assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4096,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data: any = await response.json()
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenAI API')
  }

  return {
    text: data.choices[0].message.content || 'No content in OpenAI response',
    tokens: data.usage ? {
      input: data.usage.prompt_tokens || 0,
      output: data.usage.completion_tokens || 0,
      total: data.usage.total_tokens || 0
    } : { input: 0, output: 0, total: 0 }
  }
}

async function callAnthropic(prompt: string, model: string): Promise<ModelCallResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables')
  }

  // Map RadPal model names to Anthropic model names
  let anthropicModel = 'claude-sonnet-4-20250514' // Default to Claude 4 Sonnet
  let maxTokens = 4096

  if (model.includes('opus')) {
    anthropicModel = 'claude-opus-4-20250514'
    maxTokens = 8192 // Higher token limit for Opus
  } else if (model.includes('sonnet')) {
    anthropicModel = 'claude-sonnet-4-20250514'
    maxTokens = 4096
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data: any = await response.json()
  
  if (!data.content || data.content.length === 0) {
    throw new Error('No response from Anthropic API')
  }

  return {
    text: data.content[0].text || 'No content in Anthropic response',
    tokens: data.usage ? {
      input: data.usage.input_tokens || 0,
      output: data.usage.output_tokens || 0,
      total: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
    } : { input: 0, output: 0, total: 0 }
  }
}

async function callGemini(prompt: string, model: string): Promise<ModelCallResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables')
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data: any = await response.json()
  
  if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content.parts.length) {
    throw new Error('No response from Gemini API')
  }

  return {
    text: data.candidates[0].content.parts[0].text || 'No content in Gemini response',
    tokens: data.usageMetadata ? {
      input: data.usageMetadata.promptTokenCount || 0,
      output: data.usageMetadata.candidatesTokenCount || 0,
      total: data.usageMetadata.totalTokenCount || 0
    } : { input: 0, output: 0, total: 0 }
  }
}

async function callKimi(prompt: string, model: string): Promise<ModelCallResponse> {
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
      messages: [
        {
          role: 'system',
          content: 'You are a helpful radiology assistant.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      stream: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Kimi API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data: any = await response.json()
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from Kimi API')
  }

  return {
    text: data.choices[0].message.content || 'No content in Kimi response',
    tokens: data.usage ? {
      input: data.usage.prompt_tokens || 0,
      output: data.usage.completion_tokens || 0,
      total: data.usage.total_tokens || 0
    } : { input: 0, output: 0, total: 0 }
  }
}

async function callMistralLocal(prompt: string): Promise<ModelCallResponse> {
  try {
    // Check if llama.cpp server is running
    const provider = await resolveMistralLocal()
    
    // Call the provider
    const text = await provider.generate({
      system: 'You are a helpful radiology assistant.',
      prompt: prompt,
      temperature: 0.25,
      topP: 0.9,
      maxTokens: 1200
    })
    
    return {
      text: text,
      tokens: { input: 0, output: 0, total: 0 } // Local models don't typically report token usage
    }
  } catch (error: any) {
    console.error('Error calling Mistral Local:', error)
    
    // Provide helpful error message for users
    if (error.message?.includes('llama.cpp server is not running')) {
      const helpfulError = new Error(
        'Local AI server is not running.\n\n' +
        'To use local AI:\n' +
        '1. Open a terminal/command prompt\n' +
        '2. Navigate to RadPal directory\n' + 
        '3. Run: npm run llama:serve\n' +
        '4. Keep the terminal open\n' +
        '5. Try again in RadPal\n\n' +
        'For setup help, see docs/mistral-local-setup.md'
      )
      helpfulError.name = 'LocalAINotRunning'
      throw helpfulError
    }
    
    throw error
  }
}