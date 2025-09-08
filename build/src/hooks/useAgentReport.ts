import { useState } from 'react'
import { generateReport, generateImpression } from '../../agent'
import { useAuth } from './useAuth'

export function useAgentReport() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const generateReportWithAgent = async (
    findings: string,
    studyType: string,
    model?: string
  ): Promise<{ text: string; tokens: { input: number; output: number; total: number } }> => {
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    setLoading(true)
    setError(null)

    try {
      const reportResponse = await generateReport({
        userId: user.id,
        studyType,
        findings,
        model
      })

      return {
        text: reportResponse.text,
        tokens: reportResponse.tokens || {
          input: 0,
          output: 0,
          total: 0
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate report'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const generateImpressionWithAgent = async (
    findings: string,
    studyType: string,
    model?: string
  ): Promise<{ text: string; tokens: { input: number; output: number; total: number } }> => {
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    setLoading(true)
    setError(null)

    try {
      const impressionResponse = await generateImpression({
        userId: user.id,
        studyType,
        findings,
        model
      })

      return {
        text: impressionResponse.text,
        tokens: impressionResponse.tokens || {
          input: 0,
          output: 0,
          total: 0
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate impression'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    generateReportWithAgent,
    generateImpressionWithAgent,
    loading,
    error
  }
}