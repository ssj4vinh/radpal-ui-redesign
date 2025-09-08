const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Initialize Supabase client
let supabase = null;
let currentSession = null;

function initSupabase(url, key) {
  if (!supabase && url && key) {
    supabase = createClient(url, key);
  }
  return supabase;
}

// Update session when user logs in
async function updateSession(session) {
  currentSession = session;
  if (supabase && session?.access_token) {
    try {
      // Update the Supabase client with the new auth token
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token || ''
      });
      console.log('✅ Medical terms IPC session updated');
    } catch (error) {
      console.error('❌ Failed to set medical terms session:', error);
    }
  }
}

// Helper function to get current user from stored session
async function getCurrentUser() {
  // Use the stored session instead of trying to fetch from Supabase
  if (!currentSession?.user) {
    // Try to get from global store
    const globalStore = global.electronStore;
    if (globalStore && globalStore.currentUser) {
      return { id: globalStore.currentUser };
    }
    return null;
  }
  return currentSession.user;
}

// Register IPC handlers
function registerMedicalTermsHandlers(supabaseUrl, supabaseKey) {
  initSupabase(supabaseUrl, supabaseKey);

  // Fetch user's medical terms from Supabase
  ipcMain.handle('fetch-medical-terms', async () => {
    try {
      // First try to get user from global store
      let userId = global.currentUser;
      
      // Extract the ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      if (!userId) {
        const user = await getCurrentUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }
        userId = typeof user === 'object' ? user.id : user;
      }
      
      // Ensure we have a string ID, not an object
      if (typeof userId === 'object' && userId.id) {
        userId = userId.id;
      }
      
      // Make sure session is set from global if available
      if (!currentSession && global.supabaseSession) {
        currentSession = global.supabaseSession;
        if (supabase && currentSession?.access_token) {
          await supabase.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token || ''
          });
        }
      }

      // Check if user has any terms, if not, initialize with defaults
      const { data: existingTerms, error: checkError } = await supabase
        .from('medical_terms')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (checkError) {
        console.error('Error checking existing terms:', checkError);
      }

      // Initialize default terms if user has none
      if (!existingTerms || existingTerms.length === 0) {
        // Make sure we have the session set before calling the function
        if (currentSession?.access_token) {
          await supabase.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token || ''
          });
        }
        
        const { error: initError } = await supabase
          .rpc('init_default_medical_terms', { p_user_id: userId });
        
        if (initError) {
          console.error('Error initializing default terms:', initError);
          // Continue anyway - we can still return empty terms
        }
      }

      // Fetch all user's terms
      const { data, error } = await supabase
        .rpc('get_user_medical_terms', { p_user_id: userId });

      if (error) {
        console.error('Error fetching medical terms:', error);
        return { success: false, error: error.message };
      }

      // Convert to the format expected by Deepgram
      const keywordsObj = {
        anatomy: {},
        pathology: {},
        mri_terms: {},
        directions: {},
        abbreviations: {},
        spine: {},
        custom: {}
      };

      data.forEach(term => {
        if (keywordsObj[term.category]) {
          keywordsObj[term.category][term.term] = term.weight;
        }
      });

      return { success: true, keywords: keywordsObj };
    } catch (error) {
      console.error('Error in fetch-medical-terms:', error);
      return { success: false, error: error.message };
    }
  });

  // Save user's medical terms to Supabase
  ipcMain.handle('save-medical-terms', async (event, termsArray) => {
    try {
      // First try to get user from global store
      let userId = global.currentUser;
      
      // Extract the ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      if (!userId) {
        const user = await getCurrentUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }
        userId = typeof user === 'object' ? user.id : user;
      }
      
      // Ensure we have a string ID, not an object
      if (typeof userId === 'object' && userId.id) {
        userId = userId.id;
      }

      // Convert terms array to JSONB format for bulk upsert
      const termsJson = termsArray.map(term => ({
        term: term.term,
        weight: term.weight,
        category: term.category
      }));

      // Bulk upsert all terms
      const { data, error } = await supabase
        .rpc('bulk_upsert_medical_terms', {
          p_user_id: userId,
          p_terms: termsJson
        });

      if (error) {
        console.error('Error saving medical terms:', error);
        return { success: false, error: error.message };
      }

      // Update the local cache file for Deepgram to use
      await updateLocalKeywordsCache(termsArray);

      return { success: true };
    } catch (error) {
      console.error('Error in save-medical-terms:', error);
      return { success: false, error: error.message };
    }
  });

  // Add single medical term
  ipcMain.handle('add-medical-term', async (event, term, weight, category) => {
    try {
      // First try to get user from global store
      let userId = global.currentUser;
      
      // Extract the ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      if (!userId) {
        const user = await getCurrentUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }
        userId = typeof user === 'object' ? user.id : user;
      }
      
      // Ensure we have a string ID, not an object
      if (typeof userId === 'object' && userId.id) {
        userId = userId.id;
      }

      const { data, error } = await supabase
        .rpc('upsert_medical_term', {
          p_user_id: userId,
          p_term: term,
          p_weight: weight,
          p_category: category
        });

      if (error) {
        console.error('Error adding medical term:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in add-medical-term:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete medical term
  ipcMain.handle('delete-medical-term', async (event, term, category) => {
    try {
      // First try to get user from global store
      let userId = global.currentUser;
      
      // Extract the ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      if (!userId) {
        const user = await getCurrentUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }
        userId = typeof user === 'object' ? user.id : user;
      }
      
      // Ensure we have a string ID, not an object
      if (typeof userId === 'object' && userId.id) {
        userId = userId.id;
      }

      const { error } = await supabase
        .from('medical_terms')
        .delete()
        .eq('user_id', userId)
        .eq('term', term)
        .eq('category', category);

      if (error) {
        console.error('Error deleting medical term:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in delete-medical-term:', error);
      return { success: false, error: error.message };
    }
  });

  // Load medical keywords from Supabase and update local cache
  ipcMain.handle('load-medical-keywords-from-db', async () => {
    try {
      // First try to get user from global store
      let userId = global.currentUser;
      
      // Extract the ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      if (!userId) {
        const user = await getCurrentUser();
        if (!user) {
          return { success: false, error: 'User not authenticated' };
        }
        userId = typeof user === 'object' ? user.id : user;
      }
      
      // Ensure we have a string ID, not an object
      if (typeof userId === 'object' && userId.id) {
        userId = userId.id;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .rpc('get_user_medical_terms', { p_user_id: userId });

      if (error) {
        console.error('Error loading medical terms from DB:', error);
        return { success: false, error: error.message };
      }

      // Update local cache
      await updateLocalKeywordsCache(data);

      return { success: true };
    } catch (error) {
      console.error('Error in load-medical-keywords-from-db:', error);
      return { success: false, error: error.message };
    }
  });
}

// Update local keywords cache file for Deepgram
async function updateLocalKeywordsCache(termsData) {
  try {
    const keywordsPath = path.join(__dirname, 'medical-keywords.json');
    
    // Convert to the expected format
    const keywordsObj = {
      description: "Medical keywords for Deepgram transcription boosting (from Supabase)",
      keywords: {
        anatomy: {},
        pathology: {},
        mri_terms: {},
        directions: {},
        abbreviations: {},
        spine: {},
        custom: {}
      }
    };

    // Handle both array format and object format
    if (Array.isArray(termsData)) {
      termsData.forEach(term => {
        const category = term.category || 'custom';
        if (keywordsObj.keywords[category]) {
          keywordsObj.keywords[category][term.term] = term.weight;
        }
      });
    } else {
      // It's already in object format
      for (const [category, terms] of Object.entries(termsData)) {
        if (keywordsObj.keywords[category] && typeof terms === 'object') {
          keywordsObj.keywords[category] = terms;
        }
      }
    }

    // Add comment to custom category
    keywordsObj.keywords.custom._comment = "Add your custom terms here with weights from -5 to 5";

    // Write to file
    fs.writeFileSync(keywordsPath, JSON.stringify(keywordsObj, null, 2));
    console.log('✅ Updated local medical keywords cache');

    // Notify Deepgram manager to reload keywords
    const deepgramManager = global.deepgramManager;
    if (deepgramManager) {
      deepgramManager.loadCustomKeywords();
    }

    return true;
  } catch (error) {
    console.error('Error updating local keywords cache:', error);
    return false;
  }
}

module.exports = {
  registerMedicalTermsHandlers,
  initSupabase,
  updateSession
};