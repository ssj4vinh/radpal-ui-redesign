import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseTemplates(user: any, shouldFetch: boolean = true) {
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const fetchInProgress = useRef(false)
  const lastFetchUser = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !shouldFetch) {
      setTemplates({})
      setLoading(false)
      return
    }

    // Prevent duplicate fetches
    if (fetchInProgress.current || lastFetchUser.current === user?.id) {
      return
    }
    
    const fetchTemplates = async () => {
      fetchInProgress.current = true
      lastFetchUser.current = user?.id
      setLoading(true)
      try {
        // Let the main process handle session token - just pass null for backwards compatibility
        const result = await window.electron?.ipcRenderer?.invoke('fetch-templates', user.id, null)

        setTemplates(result || {})
      } catch (err) {
        // console.error('❌ Failed to fetch templates:', err)
        setTemplates({})
      } finally {
        setLoading(false)
        fetchInProgress.current = false
      }
    }

    fetchTemplates()
  }, [user, shouldFetch])

  const saveTemplate = async (
    studyType: string,
    template: string,
    generatePrompt: string,
    generateImpression?: string
  ) => {
    if (!user) throw new Error('User not set')

    // Let the main process handle session token - just pass null for backwards compatibility
const result = await window.electron?.ipcRenderer?.invoke('save-template', {
  userId: user.id,
  accessToken: null,
  studyType,
  template,
  generatePrompt,
  generateImpression
})


    if (!result?.success) throw new Error('Save failed')
  }

  return {
    templates: templates || {},     // ✅ fallback always guaranteed
    loading: loading ?? false,
    saveTemplate: saveTemplate || (async () => {})
  }
}
