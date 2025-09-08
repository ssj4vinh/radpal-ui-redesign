
import { useState } from 'react'

export function useGpt() {
  const [loading, setLoading] = useState(false)
  const [debugPrompt, setDebugPrompt] = useState('')
  const [debugResult, setDebugResult] = useState('')

  const generateReport = async (prompt: string): Promise<{text: string, tokens: {input: number, output: number, total: number}}> => {
    setLoading(true)
    setDebugPrompt(prompt)
    try {
      const response = await window.electronAPI.generateReport(prompt)
      
      // Handle both old string format and new object format for backward compatibility
      if (typeof response === 'string') {
        const result = { text: response, tokens: { input: 0, output: 0, total: 0 } }
        setDebugResult(response)
        return result
      } else {
        setDebugResult(response.text)
        return response
      }
    } catch (error) {
      console.error('🔍 generateReport error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const readPrompt = async (name: string): Promise<string> => {
    return await window.electronAPI.readPrompt(name)
  }

  const generateReportFromTemplates = async (findings: string, templates: any, selectedStudyType?: string) => {
    const startTime = Date.now()
    let totalTokens = { input: 0, output: 0, total: 0 }
    
    try {
      let matchedType = selectedStudyType;
      
      // If no study type is provided, use classification (backward compatibility)
      if (!matchedType) {
        const classifyPrompt = await readPrompt('classify')
        const classifyResult = await generateReport(classifyPrompt.replace('{{FINDINGS}}', findings || ''))
        matchedType = classifyResult.text.trim()
        
        // Accumulate tokens from classification
        totalTokens.input += classifyResult.tokens.input
        totalTokens.output += classifyResult.tokens.output
        totalTokens.total += classifyResult.tokens.total
      }
      
      const selected = templates[matchedType]

      if (!selected || !selected.template || !selected.generate_prompt) {
        return { error: true, message: `❌ No valid template or prompt found for: ${matchedType}` }
      }

      const baseTemplate = selected.template || ''
      const basePrompt = selected.generate_prompt || ''

      const filledPrompt = basePrompt
        .replace('{{STUDY_TYPE}}', matchedType || '')
        .replace('{{TEMPLATE}}', baseTemplate || '')
        .replace('{{FINDINGS}}', findings || '')

      const cleanedPrompt = filledPrompt.replace(/{{[^}]+}}/g, '')
      const gptResult = await generateReport(cleanedPrompt)

      // Accumulate tokens from report generation
      totalTokens.input += gptResult.tokens.input
      totalTokens.output += gptResult.tokens.output
      totalTokens.total += gptResult.tokens.total

      const generationTime = ((Date.now() - startTime) / 1000).toFixed(1)

      return {
        template: baseTemplate,
        result: gptResult.text,
        studyType: matchedType,
        generationTime,
        totalTokens
      }
    } catch (err) {
      return { error: true, message: '❌ Report generation failed. See console for details.' }
    }
  }

  const generateImpressionFromTemplates = async (findings: string, templates: any, selectedStudyType?: string) => {
    const startTime = Date.now()
    let totalTokens = { input: 0, output: 0, total: 0 }
    
    try {
      let matchedType = selectedStudyType;
      
      // If no study type is provided, use classification (backward compatibility)
      if (!matchedType) {
        const classifyPrompt = await readPrompt('classify')
        const classifyResult = await generateReport(classifyPrompt.replace('{{FINDINGS}}', findings || ''))
        matchedType = classifyResult.text.trim()
        
        // Accumulate tokens from classification
        totalTokens.input += classifyResult.tokens.input
        totalTokens.output += classifyResult.tokens.output
        totalTokens.total += classifyResult.tokens.total
      }
      
      const selected = templates[matchedType]

      if (!selected || !selected.template || !selected.generate_impression) {
        return { error: true, message: `❌ No valid impression template found for: ${matchedType}` }
      }

      const baseTemplate = selected.template || ''
      const basePrompt = selected.generate_impression || ''

      const filledPrompt = basePrompt
        .replace('{{STUDY_TYPE}}', matchedType || '')
        .replace('{{TEMPLATE}}', baseTemplate || '')
        .replace('{{FINDINGS}}', findings || '')

      const cleanedPrompt = filledPrompt.replace(/{{[^}]+}}/g, '')
      const gptResult = await generateReport(cleanedPrompt)

      // Accumulate tokens from impression generation
      totalTokens.input += gptResult.tokens.input
      totalTokens.output += gptResult.tokens.output
      totalTokens.total += gptResult.tokens.total

      const generationTime = ((Date.now() - startTime) / 1000).toFixed(1)

      return {
        template: baseTemplate,
        result: gptResult.text,
        studyType: matchedType,
        generationTime,
        totalTokens
      }
    } catch (err) {
      return { error: true, message: '❌ Impression generation failed. See console for details.' }
    }
  }

  return {
    generateReport,
    loading,
    debugPrompt,
    debugResult,
    generateReportFromTemplates,
    generateImpressionFromTemplates
  }
}
