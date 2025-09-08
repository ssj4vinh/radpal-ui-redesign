import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialLoadComplete = false;

    // Clear any cached Supabase session data from localStorage since we use IPC bridge
    const clearCachedSession = () => {
      try {
        // Clear Supabase auth data that might be cached
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (err) {
        console.warn('⚠️ Failed to clear cached session data:', err);
      }
    };

    clearCachedSession();

    const init = async () => {
      try {
        const result = await window.electronAPI?.authGetSession();
        const user = result?.data?.session?.user || null;

        // console.log('🔍 Initial session check:', user ? `user found: ${user.email}` : 'no user');

        if (user) {
          setUser(user);
        } else {
          // Ensure user is cleared if no session
          setUser(null);
        }
      } catch (err) {
        console.error('❌ Failed to get initial session:', err);
        setUser(null);
      }

      // We do NOT call setLoading here — wait for onAuthStateChange
    };

    init();

    // Set up auth state listener via IPC
    const setupListener = async () => {
      try {
        await window.electronAPI?.authSetupListener();
      } catch (err) {
        console.error('❌ Failed to setup auth listener:', err);
      }
    };

    setupListener();

    // Listen for auth state changes from main process
    const handleAuthStateChange = ({ event, session }: { event: string, session: any }) => {
      // If event is INITIAL_SESSION and there's no session, make sure user is cleared
      if (event === 'INITIAL_SESSION' && !session) {
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }

      if (!initialLoadComplete) {
        setLoading(false);
        initialLoadComplete = true;
      }

      // Share auth state with main process (already handled in main process)
      if (window.electronAPI) {
        window.electronAPI.setCurrentUser(session?.user);
        window.electronAPI.setSupabaseSession(session);
      }

      // Reset window size when signing out
      if (event === 'SIGNED_OUT' && window.electronAPI) {
        setTimeout(() => {
          window.electronAPI.resetWindowSize();
        }, 300);
        // Also try again after a longer delay to ensure it takes effect
        setTimeout(() => {
          window.electronAPI.resetWindowSize();
        }, 1000);
      }
    };

    // Add event listener for auth state changes
    if (window.electronAPI?.onAuthStateChange) {
      window.electronAPI.onAuthStateChange(handleAuthStateChange);
    } else {
      console.error('❌ onAuthStateChange method not available on window.electronAPI');
    }

    // Fallback timeout to ensure loading state resolves even if auth state change doesn't fire
    const loadingTimeout = setTimeout(() => {
      if (!initialLoadComplete) {
        console.warn('⚠️ Auth state change timeout - falling back to session check');
        // Try to get session one more time as fallback
        window.electronAPI?.authGetSession().then(result => {
          const user = result?.data?.session?.user || null;
          setUser(user);
          setLoading(false);
          initialLoadComplete = true;
        }).catch(() => {
          // If that fails too, just clear loading state
          setUser(null);
          setLoading(false);
          initialLoadComplete = true;
        });
      }
    }, 3000); // 3 second timeout

    return () => {
      clearTimeout(loadingTimeout);
      // Cleanup handled by main process
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      const result = await window.electronAPI?.authSignIn(email, password);
      if (result?.error) {
        // Return the error object with better formatting
        return { error: { message: result.error }, data: null };
      }
      return result;
    } catch (err) {
      console.error('Sign-in error:', err);
      // Handle network errors or other exceptions
      return { 
        error: { 
          message: err.message || 'Network error - please check your internet connection' 
        }, 
        data: null 
      };
    }
  };

  const signUp = async (email, password) => {
    try {
      const result = await window.electronAPI?.authSignUp(email, password);
      if (result?.error) {
        // Return the error object with better formatting
        return { error: { message: result.error }, data: null };
      }
      return result;
    } catch (err) {
      console.error('Sign-up error:', err);
      // Handle network errors or other exceptions
      return { 
        error: { 
          message: err.message || 'Network error - please check your internet connection' 
        }, 
        data: null 
      };
    }
  };

  const signOut = async () => {
    const result = await window.electronAPI?.authSignOut();
    
    // Reset window size to original dimensions after logout completes
    if (window.electronAPI) {
      try {
        // Add a small delay to ensure the logout state change has been processed
        setTimeout(() => {
          window.electronAPI.resetWindowSize();
        }, 100);
      } catch (error) {
        console.warn('Failed to reset window size:', error);
      }
    }
    
    if (result?.error) {
      throw new Error(result.error);
    }
    
    return result;
  };

  return {
    signIn,
    signUp,
    signOut,
    user,
    loading
  };
}
