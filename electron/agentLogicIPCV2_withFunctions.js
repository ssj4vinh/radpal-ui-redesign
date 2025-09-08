// IPC handlers for agent logic v2 with RLS bypass using database functions
// This is an alternative version that uses database functions to bypass RLS issues

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
  console.log('✅ Config loaded from config.json in agentLogicIPCV2');
} catch (e) {
  console.log('⚠️ Config file not found in agentLogicIPCV2, using environment variables');
  config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
  };
  console.log('📌 Using Supabase URL:', config.VITE_SUPABASE_URL ? 'configured' : 'default');
}

// Initialize Supabase client with the global session
let supabase = null;

function initializeSupabase() {
  const session = global.supabaseSession;
  const supabaseUrl = config.VITE_SUPABASE_URL;
  const supabaseKey = config.VITE_SUPABASE_ANON_KEY;
  
  console.log('🔍 Initializing Supabase in agentLogicIPCV2:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    hasSession: !!session,
    hasAccessToken: !!session?.access_token
  });
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or key not configured:', {
      url: supabaseUrl || 'MISSING',
      key: supabaseKey ? 'EXISTS' : 'MISSING'
    });
    return;
  }
  
  try {
    if (session?.access_token) {
      supabase = createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        }
      );
      console.log('✅ Supabase client initialized WITH auth in agentLogicIPCV2');
    } else {
      // Initialize without auth token for basic operations
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized WITHOUT auth in agentLogicIPCV2');
    }
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    throw error;
  }
}

// Default study-specific logic structure
function getDefaultStudySpecificLogic() {
  return {
    version: "1.0",
    study_report: {
      anatomic_routing_rules: [],
      custom_rules: []
    },
    study_impression: {
      required_opening_phrase: {
        enabled: false,
        phrase: ""
      },
      priority: {
        high_priority_findings: [],
        high_priority_keywords: [],
        mid_priority_findings: [],
        mid_priority_keywords: [],
        low_priority_findings: [],
        low_priority_keywords: []
      },
      exclude_by_default: [],
      grouping_strategy: 'severity',
      auto_reordering: true,
      custom_rules: []
    }
  };
}

// Default base logic structure (v3.0 schema)
function getDefaultBaseLogic() {
  return {
    version: "3.0",
    general: {
      corrections: {
        rules: []
      },
      tone: {
        style: 'balanced'
      },
      allowed_sections: {
        enabled: true,
        sections: ["FINDINGS", "IMPRESSION"]
      },
      disallowed_symbols: {
        enabled: true,
        symbols: ["*", "**", "###", "##"]
      },
      disallowed_items: {
        patient_identifiers: true,
        names: true,
        radiology_report_title: true,
        referring_physician: true,
        radiologist_signature: true,
        credentials: true,
        date: true
      }
    },
    report: {
      formatting: {
        use_bullet_points: false,
        preserve_template_punctuation: true,
        prevent_unnecessary_capitalization: true,
        preserve_spacing_and_capitalization: true
      },
      language: {
        avoid_words: {
          enabled: false,
          words: []
        },
        avoid_phrases: {
          enabled: false,
          phrases: []
        },
        expand_lesion_descriptions: false
      }
    },
    impression: {
      format: {
        style: 'numerically_itemized',
        spacing: 'double'
      },
      exclude_by_default: []
    }
  };
}

function registerAgentLogicV2HandlersWithFunctions() {
  // Initialize Supabase when handlers are registered
  initializeSupabase();
  
  // Listen for session updates
  ipcMain.on('update-supabase-session', () => {
    initializeSupabase();
  });
  
  // Fetch agent logic v2 (base + study-specific)
  ipcMain.handle('fetch-agent-logic-v2', async (event, userId, studyType) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      // Get study-specific logic from agent_logic_2 column (with fallback to agent_logic)
      console.log('Fetching template for user:', userId, 'study:', studyType);
      let template = null;
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic_2, agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      if (templateError && templateError.code !== 'PGRST116') {
        console.error('Error fetching study logic v2:', templateError);
      } else {
        template = templateData;
      }
      
      // Get base logic from user_default_logic table
      let baseTemplate = null;
      const { data: baseData, error: baseError } = await supabase
        .from('user_default_logic')
        .select('default_agent_logic')
        .eq('user_id', userId)
        .single();
      
      if (baseError) {
        if (baseError.code === 'PGRST116') {
          console.log('No base logic found for user, using defaults');
        } else {
          console.error('Error fetching base logic:', baseError);
        }
      } else {
        baseTemplate = baseData;
      }
      
      // Use defaults if not found
      const studyLogic = template?.agent_logic_2 || getDefaultStudySpecificLogic();
      const baseLogic = baseTemplate?.default_agent_logic || getDefaultBaseLogic();
      
      // Merge for preview
      const mergedLogic = {
        ...baseLogic,
        ...studyLogic
      };
      
      const legacyLogic = template?.agent_logic || null;
      
      return {
        success: true,
        baseLogic,
        studyLogic,
        mergedLogic,
        legacyLogic
      };
    } catch (error) {
      console.error('Error fetching agent logic v2:', error);
      return { 
        success: false, 
        error: error.message,
        baseLogic: getDefaultBaseLogic(),
        studyLogic: getDefaultStudySpecificLogic()
      };
    }
  });
  
  // Update base logic using database function to bypass RLS
  ipcMain.handle('update-base-logic-v2', async (event, userId, baseLogic) => {
    try {
      console.log('📝 Updating base logic for user:', userId);
      
      if (!supabase) {
        console.log('⚠️ Supabase client not found, attempting to initialize...');
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase client could not be initialized. Check configuration.');
        }
      }
      
      // Try using the database function first (bypasses RLS)
      console.log('🔧 Attempting to use database function upsert_user_default_logic');
      const { data: funcResult, error: funcError } = await supabase
        .rpc('upsert_user_default_logic', {
          p_user_id: userId,
          p_logic: baseLogic
        });
      
      if (!funcError && funcResult) {
        console.log('✅ Base logic updated via function:', funcResult);
        return { success: true };
      }
      
      // If function doesn't exist or fails, fall back to direct insert/update
      console.log('⚠️ Function call failed, trying direct insert/update:', funcError?.message);
      
      // First check if a row exists for this user
      const { data: existing, error: checkError } = await supabase
        .from('user_default_logic')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existing) {
        // Update existing row
        const { error } = await supabase
          .from('user_default_logic')
          .update({ 
            default_agent_logic: baseLogic,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Insert new row
        const { error } = await supabase
          .from('user_default_logic')
          .insert({ 
            user_id: userId,
            default_agent_logic: baseLogic,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating base logic:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Update study-specific logic v2 using database function to bypass RLS
  ipcMain.handle('update-study-logic-v2', async (event, userId, studyType, studyLogic) => {
    try {
      console.log('📝 Updating study logic for user:', userId, 'study:', studyType);
      
      if (!supabase) {
        console.log('⚠️ Supabase client not found, attempting to initialize...');
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase client could not be initialized. Check configuration.');
        }
      }
      
      // Try using the database function first (bypasses RLS)
      console.log('🔧 Attempting to use database function update_template_agent_logic_2');
      const { data: funcResult, error: funcError } = await supabase
        .rpc('update_template_agent_logic_2', {
          p_user_id: userId,
          p_study_type: studyType,
          p_logic: studyLogic
        });
      
      if (!funcError && funcResult) {
        console.log('✅ Study logic updated via function:', funcResult);
        return { success: true, studyLogic };
      }
      
      // If function doesn't exist or fails, fall back to direct update
      console.log('⚠️ Function call failed, trying direct update:', funcError?.message);
      
      const { data, error } = await supabase
        .from('templates')
        .update({ 
          agent_logic_2: studyLogic,
          agent_logic_2_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .select();
      
      if (error) {
        console.error('❌ Error updating study logic:', error);
        throw error;
      }
      
      console.log('✅ Study logic updated successfully');
      
      return { success: true, studyLogic };
    } catch (error) {
      console.error('Error updating study logic v2:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Reset logic to defaults
  ipcMain.handle('reset-logic-v2', async (event, userId, studyType, resetType) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      if (resetType === 'base') {
        // Try function first
        const { data: funcResult, error: funcError } = await supabase
          .rpc('upsert_user_default_logic', {
            p_user_id: userId,
            p_logic: getDefaultBaseLogic()
          });
        
        if (!funcError) {
          return { success: true };
        }
        
        // Fallback to direct update
        const { data: existing, error: checkError } = await supabase
          .from('user_default_logic')
          .select('id')
          .eq('user_id', userId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existing) {
          const { error } = await supabase
            .from('user_default_logic')
            .update({ 
              default_agent_logic: getDefaultBaseLogic(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_default_logic')
            .insert({ 
              user_id: userId,
              default_agent_logic: getDefaultBaseLogic(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error) throw error;
        }
      } else {
        // Try function first for study logic
        const { data: funcResult, error: funcError } = await supabase
          .rpc('update_template_agent_logic_2', {
            p_user_id: userId,
            p_study_type: studyType,
            p_logic: getDefaultStudySpecificLogic()
          });
        
        if (!funcError) {
          return { success: true };
        }
        
        // Fallback to direct update
        const { error } = await supabase
          .from('templates')
          .update({ 
            agent_logic_2: getDefaultStudySpecificLogic(),
            agent_logic_2_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('study_type', studyType);
        
        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error resetting logic v2:', error);
      return { success: false, error: error.message };
    }
  });
  
  console.log('✅ Agent Logic V2 IPC handlers (with functions) registered');
}

module.exports = { 
  registerAgentLogicV2HandlersWithFunctions, 
  getDefaultStudySpecificLogic, 
  getDefaultBaseLogic 
};