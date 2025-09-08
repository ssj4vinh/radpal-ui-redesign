// IPC handlers for user profile management in user_subscriptions table
const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with the global session
let supabase = null;

function initializeSupabase() {
  const session = global.supabaseSession;
  if (session?.access_token) {
    supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      }
    );
  }
}

function registerUserProfileHandlers() {
  // Initialize Supabase when handlers are registered
  initializeSupabase();
  
  // Listen for session updates
  ipcMain.on('update-supabase-session', () => {
    initializeSupabase();
  });
  
  // Fetch user profile data
  ipcMain.handle('fetch-user-profile', async (event, userId) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('user_id, tier, first_name, last_name, email')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
        return { success: false, error: error.message };
      }
      
      // If no record exists, return default structure
      if (!data) {
        return {
          success: true,
          profile: {
            user_id: userId,
            tier: 1, // Default tier
            first_name: null,
            last_name: null,
            email: null
          }
        };
      }
      
      return {
        success: true,
        profile: data
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch user profile'
      };
    }
  });
  
  // Update user profile data
  ipcMain.handle('update-user-profile', async (event, userId, profileData) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      // First check if a record exists
      const { data: existing, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      // Prepare the data to update
      const updateData = {
        ...profileData,
        updated_at: new Date().toISOString()
      };
      
      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('user_subscriptions')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          success: true,
          profile: data
        };
      } else {
        // Insert new record with profile data
        const { data, error } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            tier: profileData.tier || 1,
            first_name: profileData.first_name || null,
            last_name: profileData.last_name || null,
            email: profileData.email || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          success: true,
          profile: data
        };
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update user profile'
      };
    }
  });
  
  // Update just the email (useful when user signs up/logs in)
  ipcMain.handle('update-user-email', async (event, userId, email) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      // Check if record exists
      const { data: existing, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('user_id', userId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ 
            email: email,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Create new record with email
        const { error } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            email: email,
            tier: 1, // Default tier
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating user email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update user email'
      };
    }
  });
  
  console.log('✅ User Profile IPC handlers registered');
}

module.exports = { registerUserProfileHandlers };