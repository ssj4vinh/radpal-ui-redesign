import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // safe in Electron, not on web!
})

export async function generateGPTResponse(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful radiology assistant.' },
      { role: 'user', content: prompt }
    ]
  })

  return response.choices[0]?.message?.content ?? ''
}
