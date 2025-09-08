import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { offlineStorage } from '../services/offlineStorage'

export function useSupabaseTemplatesWithOffline(user: any, shouldFetch: boolean = true, isOfflineMode: boolean = false) {
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
        if (isOfflineMode) {
          // Load from offline-only storage (separate from synced templates)
          console.log('📦 Loading templates from offline-only storage')
          const offlineOnlyTemplates = offlineStorage.getOfflineOnlyTemplates()
          
          // If no offline-only templates exist, initialize from synced templates
          if (Object.keys(offlineOnlyTemplates).length === 0) {
            const syncedTemplates = offlineStorage.getTemplates()
            offlineStorage.saveOfflineOnlyTemplates(syncedTemplates)
            setTemplates(syncedTemplates)
          } else {
            setTemplates(offlineOnlyTemplates)
          }
        } else {
          // Try to fetch from Supabase
          try {
            // Let the main process handle session token - just pass null for backwards compatibility
            const result = await window.electron?.ipcRenderer?.invoke('fetch-templates', user.id, null)

            if (result) {
              setTemplates(result)
              // Save to offline storage as backup (but don't overwrite offline-only templates)
              offlineStorage.saveTemplates(result)
            } else {
              throw new Error('No templates returned')
            }
          } catch (err) {
            console.log('⚠️ Failed to fetch from Supabase, using offline cache')
            const offlineTemplates = offlineStorage.getTemplates()
            setTemplates(offlineTemplates)
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch templates:', err)
        setTemplates({})
      } finally {
        setLoading(false)
        fetchInProgress.current = false
      }
    }

    fetchTemplates()
  }, [user, shouldFetch, isOfflineMode])

  const saveTemplate = async (
    studyType: string,
    template: string,
    generatePrompt: string,
    generateImpression?: string,
    showDiffView?: boolean
  ) => {
    if (!user) throw new Error('User not set')

    const templateData = {
      template,
      generatePrompt,
      generateImpression,
      showDiffView: showDiffView ?? true
    }

    if (isOfflineMode) {
      // Save to offline-only storage (separate from synced templates)
      console.log('💾 Saving template to offline-only storage')
      const currentTemplates = offlineStorage.getOfflineOnlyTemplates()
      currentTemplates[studyType] = templateData
      offlineStorage.saveOfflineOnlyTemplates(currentTemplates)
      
      // Update local state
      setTemplates(currentTemplates)
      
      return { success: true }
    }

    // Try to save to Supabase
    try {
      // Let the main process handle session token - just pass null for backwards compatibility
      const result = await window.electron?.ipcRenderer?.invoke('save-template', {
        userId: user.id,
        accessToken: null,
        studyType,
        template,
        generatePrompt,
        generateImpression,
        showDiffView
      })

      if (!result?.success) throw new Error('Save to Supabase failed')

      // Update offline storage as well (for synced templates backup)
      const currentTemplates = offlineStorage.getTemplates()
      currentTemplates[studyType] = templateData
      offlineStorage.saveTemplates(currentTemplates)
      
      // Update local state
      setTemplates(currentTemplates)
      
    } catch (err) {
      console.log('⚠️ Failed to save to Supabase, saving to offline storage only')
      
      // Fallback to offline storage
      const currentTemplates = offlineStorage.getTemplates()
      currentTemplates[studyType] = templateData
      offlineStorage.saveTemplates(currentTemplates)
      
      // Update local state
      setTemplates(currentTemplates)
    }
  }

  const refetchTemplates = async () => {
    if (!user || !shouldFetch) {
      return
    }
    
    fetchInProgress.current = false // Reset to allow refetch
    lastFetchUser.current = null // Reset to allow refetch
    
    // Trigger refetch
    const fetchTemplates = async () => {
      fetchInProgress.current = true
      lastFetchUser.current = user?.id
      setLoading(true)
      
      try {
        if (isOfflineMode) {
          const offlineOnlyTemplates = offlineStorage.getOfflineOnlyTemplates()
          setTemplates(offlineOnlyTemplates)
        } else {
          const result = await window.electron?.ipcRenderer?.invoke('fetch-templates', user.id, null)
          if (result) {
            setTemplates(result)
            if (!isOfflineMode) {
              offlineStorage.saveTemplates(result)
            }
          }
        }
      } catch (err) {
        console.error('❌ Failed to refetch templates:', err)
        if (!isOfflineMode) {
          const offlineTemplates = offlineStorage.getTemplates()
          setTemplates(offlineTemplates)
        }
      } finally {
        setLoading(false)
        fetchInProgress.current = false
      }
    }
    
    await fetchTemplates()
  }

  return {
    templates: templates || {},
    loading: loading ?? false,
    saveTemplate: saveTemplate || (async () => {}),
    refetchTemplates
  }
}