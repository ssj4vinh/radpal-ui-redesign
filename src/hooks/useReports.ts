import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import type { Report } from '../supabase/reportQueries'

export interface ReportWithTracking extends Report {
  isDirty?: boolean // Track if edited_result differs from initial_result
}

export function useReports() {
  const [reports, setReports] = useState<ReportWithTracking[]>([])
  const [currentReport, setCurrentReport] = useState<ReportWithTracking | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // Save a new report
  const saveReport = useCallback(async (
    studyType: string,
    findings: string,
    initialResult: string,
    modelUsed?: string,
    tokensUsed?: { input: number; output: number; total: number },
    promptUsed?: string,
    userFeedback?: string
  ): Promise<ReportWithTracking | null> => {
    if (!user?.id) {
      setError('User not authenticated')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('report:save', {
        user_id: user.id,
        study_type: studyType,
        findings,
        initial_result: initialResult,
        model_used: modelUsed,
        tokens_used: tokensUsed,
        prompt_used: promptUsed,
        user_feedback: userFeedback
      })

      if (result.success) {
        const newReport = result.data as ReportWithTracking
        setCurrentReport(newReport)
        setReports(prev => [newReport, ...prev])
        return newReport
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save report'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  // Update report with edited result
  const updateReport = useCallback(async (
    reportId: string,
    editedResult: string,
    userFeedback?: string
  ): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const updates: any = { edited_result: editedResult }
      if (userFeedback !== undefined) {
        updates.user_feedback = userFeedback
      }
      
      const result = await window.electron.ipcRenderer.invoke('report:update', {
        id: reportId,
        updates
      })

      if (result.success) {
        const updatedReport = result.data as ReportWithTracking
        updatedReport.isDirty = updatedReport.edited_result !== updatedReport.initial_result
        
        // Update current report if it's the one being edited
        if (currentReport?.id === reportId) {
          setCurrentReport(updatedReport)
        }
        
        // Update in reports list
        setReports(prev => prev.map(r => 
          r.id === reportId ? updatedReport : r
        ))
        
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update report'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [currentReport])

  // Load reports for the current user
  const loadUserReports = useCallback(async (limit = 50, offset = 0) => {
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('report:getUserReports', {
        userId: user.id,
        limit,
        offset
      })

      if (result.success) {
        const loadedReports = result.data as ReportWithTracking[]
        // Mark reports as dirty if they have been edited
        loadedReports.forEach(report => {
          report.isDirty = report.edited_result && report.edited_result !== report.initial_result
        })
        setReports(loadedReports)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reports'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Load reports by study type
  const loadReportsByStudyType = useCallback(async (studyType: string) => {
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('report:getByStudyType', {
        userId: user.id,
        studyType
      })

      if (result.success) {
        const loadedReports = result.data as ReportWithTracking[]
        loadedReports.forEach(report => {
          report.isDirty = report.edited_result && report.edited_result !== report.initial_result
        })
        setReports(loadedReports)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reports by study type'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Delete a report
  const deleteReport = useCallback(async (reportId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('report:delete', reportId)

      if (result.success) {
        // Remove from local state
        setReports(prev => prev.filter(r => r.id !== reportId))
        
        // Clear current report if it was deleted
        if (currentReport?.id === reportId) {
          setCurrentReport(null)
        }
        
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete report'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [currentReport])

  // Search reports
  const searchReports = useCallback(async (searchTerm: string) => {
    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('report:search', {
        userId: user.id,
        searchTerm
      })

      if (result.success) {
        const searchResults = result.data as ReportWithTracking[]
        searchResults.forEach(report => {
          report.isDirty = report.edited_result && report.edited_result !== report.initial_result
        })
        setReports(searchResults)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search reports'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Check if current content matches any saved report
  const checkForExistingReport = useCallback((
    findings: string,
    studyType: string
  ): ReportWithTracking | undefined => {
    return reports.find(r => 
      r.findings === findings && 
      r.study_type === studyType
    )
  }, [reports])

  return {
    // State
    reports,
    currentReport,
    loading,
    error,
    
    // Actions
    saveReport,
    updateReport,
    loadUserReports,
    loadReportsByStudyType,
    deleteReport,
    searchReports,
    checkForExistingReport,
    setCurrentReport,
    
    // Utilities
    clearError: () => setError(null)
  }
}