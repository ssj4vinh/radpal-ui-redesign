// IPC handlers for global base prompt management
const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// Load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available in production, which is fine
  }
}

// Load config
let config;
try {
  config = require('./config.json');
} catch (e) {
  console.log('⚠️ Config file not found in globalBasePromptIPC, using environment variables');
  config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
  };
}

// Initialize Supabase client
let supabase = null;

function initializeSupabase() {
  const session = global.supabaseSession;
  const supabaseUrl = config.VITE_SUPABASE_URL;
  const supabaseKey = config.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or key not configured');
    return;
  }
  
  try {
    if (session?.access_token) {
      console.log('✅ Initializing Supabase WITH auth token for global base prompt');
      supabase = createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );
    } else {
      console.log('⚠️ Supabase client initialized WITHOUT auth in globalBasePromptIPC');
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    throw error;
  }
}

// Cache for base prompt (5 minute TTL)
let basePromptCache = {
  prompt: null,
  timestamp: null,
  TTL: 5 * 60 * 1000 // 5 minutes
};

function isCacheValid() {
  if (!basePromptCache.prompt || !basePromptCache.timestamp) {
    return false;
  }
  return Date.now() - basePromptCache.timestamp < basePromptCache.TTL;
}

// Default base prompt fallback
const DEFAULT_BASE_PROMPT = `You are an expert radiologist generating a comprehensive radiology report.

TEMPLATE STRUCTURE - You MUST follow this exact structure:

[TEMPLATE WILL BE INSERTED HERE]

IMPORTANT: Preserve ALL section headers EXACTLY as shown above.

IMPORTANT: The following imaging findings MUST be incorporated:

=== FINDINGS TO INCORPORATE ===
[YOUR DICTATED FINDINGS WILL BE INSERTED HERE]
=== END OF FINDINGS ===

=== CRITICAL RULES ===
• You must incorporate ALL findings provided above into the appropriate sections
• The ONLY allowed sections are "Findings" and "Impression"
• Do not add any other sections (no Technique, no Comparison, no Clinical Information, etc.)
`;

// IPC handler to fetch global base prompt
ipcMain.handle('fetch-global-base-prompt', async () => {
  try {
    console.log('📝 Fetching global base prompt...');
    
    // Check cache first
    if (isCacheValid()) {
      console.log('✅ Returning cached base prompt');
      return {
        success: true,
        basePrompt: basePromptCache.prompt
      };
    }
    
    // Re-initialize with current session if needed
    initializeSupabase();
    
    if (!supabase) {
      console.error('Supabase client not initialized');
      return {
        success: false,
        error: 'Database connection not available',
        basePrompt: DEFAULT_BASE_PROMPT
      };
    }
    
    // Fetch active base prompt from database
    const { data, error } = await supabase
      .from('global_base_prompt')
      .select('base_prompt, version, updated_at')
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Error fetching global base prompt:', error);
      
      // If table doesn't exist yet, return default
      if (error.code === '42P01') {
        console.log('Table does not exist yet, returning default base prompt');
        return {
          success: true,
          basePrompt: DEFAULT_BASE_PROMPT
        };
      }
      
      return {
        success: false,
        error: error.message,
        basePrompt: DEFAULT_BASE_PROMPT
      };
    }
    
    if (data && data.base_prompt) {
      // Update cache
      basePromptCache.prompt = data.base_prompt;
      basePromptCache.timestamp = Date.now();
      
      console.log('✅ Global base prompt fetched successfully (v' + data.version + ')');
      return {
        success: true,
        basePrompt: data.base_prompt,
        version: data.version,
        updatedAt: data.updated_at
      };
    }
    
    // No active prompt found, return default
    console.log('No active base prompt found, returning default');
    return {
      success: true,
      basePrompt: DEFAULT_BASE_PROMPT
    };
    
  } catch (error) {
    console.error('Error in fetch-global-base-prompt:', error);
    return {
      success: false,
      error: error.message,
      basePrompt: DEFAULT_BASE_PROMPT
    };
  }
});

// IPC handler to update global base prompt (tier 4 only)
ipcMain.handle('update-global-base-prompt', async (event, userId, newPrompt) => {
  try {
    console.log('📝 Updating global base prompt for user:', userId);
    
    // Re-initialize with current session
    initializeSupabase();
    
    if (!supabase) {
      console.error('Supabase client not initialized');
      return {
        success: false,
        error: 'Database connection not available'
      };
    }
    
    // First check if user is tier 4
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return {
        success: false,
        error: 'Could not verify user permissions'
      };
    }
    
    if (profile.tier < 5) {
      return {
        success: false,
        error: 'Only tier 5+ users can update the global base prompt'
      };
    }
    
    // Call the update function
    const { data, error } = await supabase.rpc('update_global_base_prompt', {
      new_prompt: newPrompt,
      user_id: userId
    });
    
    if (error) {
      console.error('Error updating global base prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
    
    if (data && data.success) {
      // Clear cache
      basePromptCache.prompt = null;
      basePromptCache.timestamp = null;
      
      console.log('✅ Global base prompt updated successfully to version', data.version);
      return {
        success: true,
        version: data.version,
        updatedAt: data.updated_at
      };
    }
    
    return {
      success: false,
      error: data?.error || 'Failed to update base prompt'
    };
    
  } catch (error) {
    console.error('Error in update-global-base-prompt:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handler to get base prompt history (tier 4 only)
ipcMain.handle('fetch-base-prompt-history', async (event, userId) => {
  try {
    console.log('📝 Fetching base prompt history...');
    
    // Re-initialize with current session
    initializeSupabase();
    
    if (!supabase) {
      return {
        success: false,
        error: 'Database connection not available'
      };
    }
    
    // Check if user is tier 4
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .single();
    
    if (!profile || profile.tier < 5) {
      return {
        success: false,
        error: 'Only tier 5+ users can view prompt history'
      };
    }
    
    // Fetch history
    const { data, error } = await supabase
      .from('global_base_prompt')
      .select('version, base_prompt, last_updated_by, updated_at, is_active')
      .order('version', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching base prompt history:', error);
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: true,
      history: data || []
    };
    
  } catch (error) {
    console.error('Error in fetch-base-prompt-history:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

module.exports = { initializeSupabase };