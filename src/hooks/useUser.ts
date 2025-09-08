import { useState, useEffect } from 'react'

export function useUser() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial user via IPC
    const getInitialUser = async () => {
      try {
        const result = await window.electronAPI?.authGetUser()
        setUser(result?.data?.user || null)
      } catch (err) {
        console.error('❌ Failed to get initial user:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getInitialUser()

    // Set up auth state listener via IPC
    const setupListener = async () => {
      try {
        await window.electronAPI?.authSetupListener()
      } catch (err) {
        console.error('❌ Failed to setup auth listener:', err)
      }
    }

    setupListener()

    // Listen for auth state changes from main process
    const handleAuthStateChange = ({ event, session }: { event: string, session: any }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    }

    // Add event listener for auth state changes
    window.electronAPI?.onAuthStateChange?.(handleAuthStateChange)

    return () => {
      // Cleanup handled by main process
    }
  }, [])

  return { user, loading }
}