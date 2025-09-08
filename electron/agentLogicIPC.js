/**
 * IPC handlers for enhanced agent logic with inheritance
 * To be imported and registered in main.js
 */

const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (will be set from main.js)
let supabase = null;

function initSupabase(supabaseUrl, supabaseKey) {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
}

// Default logic structure - Version 3.0 Standardized Schema
function getDefaultAgentLogic() {
  return {
    version: "3.0",
    general: {
      corrections: {
        enabled: true,
        rules: [
          {
            find: "  ",
            replace: " ",
            description: "Replace double spaces with single space"
          }
        ]
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
        symbols: ["*"]
      },
      disallowed_items: {
        enabled: true,
        items: [
          "patient identifiers",
          "names",
          "radiology report",
          "patient information",
          "referring physician",
          "radiologist signature",
          "credentials",
          "date"
        ]
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

// Deep merge utility
function deepMergeLogic(target, source) {
  if (!target || typeof target !== 'object') return source;
  if (!source || typeof source !== 'object') return target;
  
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        // Merge arrays, removing duplicates
        const combined = [...targetValue, ...sourceValue];
        result[key] = [...new Set(combined)];
      } else {
        result[key] = [...sourceValue];
      }
    } else if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      // Recursively merge objects
      result[key] = deepMergeLogic(targetValue || {}, sourceValue);
    } else {
      // Primitive values - source overwrites target
      result[key] = sourceValue;
    }
  }
  
  return result;
}

// Register IPC handlers
function registerHandlers() {
  // Fetch merged logic for report generation
  ipcMain.handle('fetch-merged-logic', async (event, userId, studyType) => {
    try {
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      // Get template with study-specific logic
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }
      
      // Get base logic (from any template with default_agent_logic)
      const { data: baseTemplate, error: baseError } = await supabase
        .from('templates')
        .select('default_agent_logic')
        .eq('user_id', userId)
        .not('default_agent_logic', 'is', null)
        .limit(1)
        .single();
      
      // Start with system default
      let mergedLogic = getDefaultAgentLogic();
      
      // Apply user's base logic if exists
      if (baseTemplate?.default_agent_logic) {
        mergedLogic = deepMergeLogic(mergedLogic, baseTemplate.default_agent_logic);
      }
      
      // Apply study-specific logic if exists
      if (template?.agent_logic) {
        mergedLogic = deepMergeLogic(mergedLogic, template.agent_logic);
      }
      
      return {
        success: true,
        mergedLogic,
        hasBaseLogic: !!baseTemplate?.default_agent_logic,
        hasStudyLogic: !!template?.agent_logic
      };
    } catch (error) {
      console.error('Error fetching merged logic:', error);
      return {
        error: error.message,
        mergedLogic: getDefaultAgentLogic() // Fallback to default
      };
    }
  });
  
  // Note: fetch-template-for-generation is already handled by supabasebridge.js
  // We'll enhance it separately if needed
  
  // Update base logic
  ipcMain.handle('update-base-logic', async (event, userId, baseLogic) => {
    try {
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      const { error } = await supabase
        .from('templates')
        .update({ 
          default_agent_logic: baseLogic,
          default_agent_logic_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error updating base logic:', error);
      return { error: error.message };
    }
  });
  
  // Update study-specific logic
  ipcMain.handle('update-study-logic', async (event, userId, studyType, studyLogic) => {
    try {
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      const { error } = await supabase
        .from('templates')
        .update({ 
          agent_logic: studyLogic,
          agent_logic_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('study_type', studyType);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error updating study logic:', error);
      return { error: error.message };
    }
  });
  
  // Get current logic layers
  ipcMain.handle('get-logic-layers', async (event, userId, studyType) => {
    try {
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      // Get study-specific logic
      const { data: template } = await supabase
        .from('templates')
        .select('agent_logic, agent_logic_updated_at')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      // Get base logic
      const { data: baseTemplate } = await supabase
        .from('templates')
        .select('default_agent_logic, default_agent_logic_updated_at')
        .eq('user_id', userId)
        .not('default_agent_logic', 'is', null)
        .limit(1)
        .single();
      
      return {
        success: true,
        defaultLogic: getDefaultAgentLogic(),
        baseLogic: baseTemplate?.default_agent_logic || null,
        studyLogic: template?.agent_logic || null,
        lastUpdated: {
          base: baseTemplate?.default_agent_logic_updated_at,
          study: template?.agent_logic_updated_at
        }
      };
    } catch (error) {
      console.error('Error getting logic layers:', error);
      return {
        error: error.message,
        defaultLogic: getDefaultAgentLogic()
      };
    }
  });
}

module.exports = {
  initSupabase,
  registerHandlers,
  getDefaultAgentLogic
};