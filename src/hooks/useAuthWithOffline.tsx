import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { offlineStorage } from '../services/offlineStorage'
import type { User } from '@supabase/supabase-js'

interface UseAuthWithOfflineReturn {
  user: User | null
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string) => Promise<any>
  signOut: () => Promise<void>
  loading: boolean
  isOfflineMode: boolean
  lastSyncTime: Date | null
  syncWithSupabase: () => Promise<void>
  // Legacy stub functions for compatibility
  setOfflineUser?: () => void
  setIsOfflineMode?: () => void
  setLastSyncTime?: () => void
}

export function useAuthWithOffline(): UseAuthWithOfflineReturn {
  const { user: supabaseUser, signIn: supabaseSignIn, signUp: supabaseSignUp, signOut: supabaseSignOut, loading } = useAuth()
  const [isOfflineMode, setIsOfflineModeState] = useState(false)
  const [offlineUser, setOfflineUserState] = useState<User | null>(null)
  const [lastSyncTime, setLastSyncTimeState] = useState<Date | null>(null)

  console.log('🔥 useAuthWithOffline called - supabaseUser from useAuth:', supabaseUser ? `${supabaseUser.email} (${supabaseUser.id})` : 'null');

  // Clear any stale offline user data on hook initialization
  useEffect(() => {
    setOfflineUserState(null)
    setIsOfflineModeState(false)
  }, [])

  // Check if we're in offline mode - but since we have IPC bridge, only use offline mode as a last resort
  useEffect(() => {
    const checkOfflineStatus = async () => {
      try {
        // Since we have IPC bridge, we don't need to go offline when renderer can't reach Supabase
        // Only enter offline mode if the main process also can't reach Supabase
        console.log('🔌 Using IPC bridge for Supabase calls - staying online unless explicitly needed')
        setIsOfflineModeState(false)
        
        // Save current user to offline storage for backup, but don't use offline user
        if (supabaseUser) {
          offlineStorage.saveUser(supabaseUser)
          setOfflineUserState(null)
        }
      } catch (error) {
        console.log('🔌 Error in offline check, staying online with IPC bridge')
        setIsOfflineModeState(false)
      }
    }

    checkOfflineStatus()
    // Check every 30 seconds - but mainly just to update sync time
    const interval = setInterval(checkOfflineStatus, 30000)
    return () => clearInterval(interval)
  }, [supabaseUser])

  // Sync data when coming back online
  const syncWithSupabase = async () => {
    if (!isOfflineMode || !supabaseUser) return

    try {
      console.log('🔄 Attempting to sync offline data with Supabase...')
      // Here you would sync any offline changes back to Supabase
      // For now, just update the sync timestamp
      offlineStorage.updateLastSync()
      setLastSyncTimeState(new Date())
      console.log('✅ Sync completed')
    } catch (error) {
      console.error('❌ Sync failed:', error)
    }
  }


  // Return the appropriate user based on mode - since we have IPC bridge, only use offline user in true offline mode
  const user = supabaseUser || (isOfflineMode ? offlineUser : null)
  
  // Add useEffect to debug when supabaseUser changes
  useEffect(() => {
    console.log('🔥 supabaseUser changed in useAuthWithOffline:', supabaseUser ? `${supabaseUser.email} (${supabaseUser.id})` : 'null');
  }, [supabaseUser]);
  

  console.log('🔥 useAuthWithOffline returning user:', user ? `${user.email} (${user.id})` : 'null');

  return {
    user,
    signIn: supabaseSignIn,
    signUp: supabaseSignUp,
    signOut: supabaseSignOut,
    loading,
    isOfflineMode,
    lastSyncTime,
    syncWithSupabase,
    // Provide actual setter functions for legacy code compatibility  
    setOfflineUser: (newUser: any) => {
      // Use the internal state setter
      if (newUser) {
        setOfflineUserState(newUser as User)
      }
    },
    setIsOfflineMode: (mode: boolean) => {
      setIsOfflineModeState(mode)
    },
    setLastSyncTime: (time: Date | null) => {
      setLastSyncTimeState(time)
    }
  }
}