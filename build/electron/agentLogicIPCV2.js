// IPC handlers for agent logic v2 (study-specific logic in agent_logic_2 column)
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

function registerAgentLogicV2Handlers() {
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
      let template = null;
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic_2, agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      if (templateError && templateError.code !== 'PGRST116') {
        // If column doesn't exist, try just agent_logic
        if (templateError.code === '42703' && templateError.message.includes('agent_logic_2')) {
          console.log('agent_logic_2 column not found, falling back to agent_logic');
          const { data: fallbackTemplate, error: fallbackError } = await supabase
            .from('templates')
            .select('agent_logic')
            .eq('user_id', userId)
            .eq('study_type', studyType)
            .single();
          
          if (fallbackError && fallbackError.code !== 'PGRST116') {
            console.error('Error fetching fallback logic:', fallbackError);
          }
          template = fallbackTemplate;
        } else {
          console.error('Error fetching study logic v2:', templateError);
        }
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
          // No row exists for this user yet
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
      
      return {
        success: true,
        baseLogic,
        studyLogic,
        mergedLogic,
        legacyLogic: template?.agent_logic // Include legacy for reference
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
  
  // Update base logic in user_default_logic table
  ipcMain.handle('update-base-logic-v2', async (event, userId, baseLogic) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
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
  
  // Update study-specific logic v2 (uses agent_logic_2 column)
  ipcMain.handle('update-study-logic-v2', async (event, userId, studyType, studyLogic) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      const { error } = await supabase
        .from('templates')
        .update({ 
          agent_logic_2: studyLogic,
          agent_logic_2_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('study_type', studyType);
      
      if (error) throw error;
      
      return { success: true };
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
        // Reset base logic to defaults in user_default_logic table
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
              default_agent_logic: getDefaultBaseLogic(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          // Insert new row with defaults
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
        // Reset study logic to defaults
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
  
  console.log('✅ Agent Logic V2 IPC handlers registered');
}

module.exports = { registerAgentLogicV2Handlers, getDefaultStudySpecificLogic, getDefaultBaseLogic };