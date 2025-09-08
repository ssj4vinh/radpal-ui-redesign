import { useState, useEffect } from 'react';

export interface UserProfile {
  user_id: string;
  tier: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (profileData: Partial<Omit<UserProfile, 'user_id'>>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

export function useUserProfile(userId: string | null): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (window.electronAPI?.invoke) {
        const result = await window.electronAPI.invoke('fetch-user-profile', userId);
        
        if (result.success) {
          setProfile(result.profile);
        } else {
          setError(result.error || 'Failed to fetch user profile');
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData: Partial<Omit<UserProfile, 'user_id'>>): Promise<boolean> => {
    if (!userId) {
      setError('No user ID available');
      return false;
    }

    try {
      setError(null);

      if (window.electronAPI?.invoke) {
        const result = await window.electronAPI.invoke('update-user-profile', userId, profileData);
        
        if (result.success) {
          setProfile(result.profile);
          return true;
        } else {
          setError(result.error || 'Failed to update user profile');
          return false;
        }
      }
      return false;
    } catch (err) {
      console.error('Error updating user profile:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile
  };
}

// Helper hook to automatically sync email from auth user
export function useAutoSyncEmail(userId: string | null, userEmail: string | null) {
  useEffect(() => {
    if (!userId || !userEmail) return;

    const syncEmail = async () => {
      try {
        if (window.electronAPI?.invoke) {
          await window.electronAPI.invoke('update-user-email', userId, userEmail);
        }
      } catch (err) {
        console.error('Error syncing user email:', err);
      }
    };

    syncEmail();
  }, [userId, userEmail]);
}