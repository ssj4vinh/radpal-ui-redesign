/**
 * IPC handlers for enhanced agent logic with inheritance
 * Using separate table for default logic (one per user)
 */

const { ipcMain } = require('electron');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Set fetch globally for Supabase
if (!global.fetch) {
  global.fetch = fetch;
  global.Headers = fetch.Headers;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  console.log('✅ node-fetch configured for Supabase');
}

// Initialize Supabase client (will be set from main.js)
let supabaseUrl = null;
let supabaseKey = null;

function initSupabase(url, key) {
  supabaseUrl = url;
  supabaseKey = key;
}

// Create authenticated client with user's token
function createAuthedClient(token) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not initialized');
  }
  
  console.log('🔑 Creating Supabase client with auth token');
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      },
      fetch: global.fetch // Explicitly pass fetch
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

// Default logic structure
function getDefaultAgentLogic() {
  return {
    version: "2.0",
    formatting: {
      preserve_template_punctuation: true,
      use_bullet_points: false,
      capitalize_sections: true
    },
    report: {
      no_hallucinated_findings: true,
      include_technique_section: false,
      expand_lesions: false
    },
    impression: {
      numerically_itemized: true,
      omit_minor_or_incidental_findings_unless_relevant: false,
      concise_summary: false,
      include_recommendations: false,
      first_item_should_address_clinical_concern: false,
      exclude_by_default: [
        "small_joint_effusion",
        "small_joint_effusions",
        "trace_joint_effusion",
        "trace_bursitis",
        "mild_tendinosis",
        "minimal_degenerative_changes",
        "small_baker_cyst",
        "small_bakers_cyst",
        "small_baker's_cyst",
        "small_baker's_cysts",
        "mild_bone_marrow_edema",
        "minimal_synovitis",
        "trace_fluid"
      ],
      mention_muscle_atrophy_if: "moderate_or_severe"
    },
    anatomy: {
      combine_meniscus_and_cartilage_findings: false,
      group_by_anatomic_region: false
    },
    clinical: {
      correlate_with_symptoms: false,
      mention_clinical_significance: false
    },
    measurements: {
      include_all_measurements: true,
      use_metric_system: true
    },
    severity: {
      use_standard_grading: false,
      avoid_vague_terms: false
    },
    style: {
      active_voice: false,
      professional_tone: true
    },
    custom_instructions: []
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
      // Get session token from global
      const session = global.supabaseSession;
      const token = session?.access_token;
      
      if (!token) {
        console.log('⚠️ No access token available for fetch-merged-logic');
        return { error: 'No authentication token available' };
      }
      
      const supabase = createAuthedClient(token);
      
      console.log('📊 Fetching study-specific logic for:', { userId, studyType });
      
      // Get study-specific logic from templates table
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      console.log('📊 Template query result:', { data: template, error: templateError });
      
      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }
      
      console.log('📊 Fetching user default logic for:', userId);
      
      // Get user's default logic from separate table
      const { data: userDefault, error: defaultError } = await supabase
        .from('user_default_logic')
        .select('default_agent_logic')
        .eq('user_id', userId)
        .single();
      
      console.log('📊 User default query result:', { data: userDefault, error: defaultError });
      
      if (defaultError && defaultError.code !== 'PGRST116') {
        console.log('No user default logic found, will use system defaults');
      }
      
      // Start with system default
      let mergedLogic = getDefaultAgentLogic();
      
      // Apply user's base logic if exists
      if (userDefault?.default_agent_logic) {
        mergedLogic = deepMergeLogic(mergedLogic, userDefault.default_agent_logic);
      }
      
      // Apply study-specific logic if exists
      if (template?.agent_logic) {
        mergedLogic = deepMergeLogic(mergedLogic, template.agent_logic);
      }
      
      return {
        success: true,
        mergedLogic,
        hasBaseLogic: !!userDefault?.default_agent_logic,
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
  
  // Update base logic (in separate table)
  ipcMain.handle('update-base-logic', async (event, userId, baseLogic) => {
    console.log('📨 IPC update-base-logic called:', { userId, hasLogic: !!baseLogic });
    
    try {
      // Get session token from global
      const session = global.supabaseSession;
      const token = session?.access_token;
      
      if (!token) {
        console.log('⚠️ No access token available for update-base-logic');
        return { error: 'No authentication token available' };
      }
      
      console.log('🔑 Creating authenticated Supabase client');
      const supabase = createAuthedClient(token);
      
      console.log('📊 Checking if user has existing default logic');
      
      // Check if user already has default logic
      const { data: existing, error: checkError } = await supabase
        .from('user_default_logic')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      console.log('📊 Existing check result:', { hasExisting: !!existing, error: checkError });
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing logic:', checkError);
        throw checkError;
      }
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('user_default_logic')
          .update({ 
            default_agent_logic: baseLogic,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_default_logic')
          .insert({ 
            user_id: userId,
            default_agent_logic: baseLogic
          });
        
        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating base logic:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Return more detailed error info
      return { 
        error: error.message || 'Unknown error',
        details: error.toString(),
        stack: error.stack
      };
    }
  });
  
  // Update study-specific logic
  ipcMain.handle('update-study-logic', async (event, userId, studyType, studyLogic) => {
    try {
      // Get session token from global
      const session = global.supabaseSession;
      const token = session?.access_token;
      
      if (!token) {
        console.log('⚠️ No access token available for update-study-logic');
        return { error: 'No authentication token available' };
      }
      
      const supabase = createAuthedClient(token);
      
      const { error } = await supabase
        .from('templates')
        .update({ 
          agent_logic: studyLogic
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
    console.log('📨 IPC get-logic-layers called:', { userId, studyType });
    
    try {
      // Get session token from global
      const session = global.supabaseSession;
      const token = session?.access_token;
      console.log('🔑 Session available:', !!session, 'Token available:', !!token);
      
      if (!token) {
        console.log('⚠️ No access token available for get-logic-layers');
        return { error: 'No authentication token available' };
      }
      
      const supabase = createAuthedClient(token);
      
      console.log('📊 [get-logic-layers] Fetching study logic for:', { userId, studyType });
      
      // Get study-specific logic
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      console.log('📊 [get-logic-layers] Template result:', { hasData: !!template, error: templateError });
      
      console.log('📊 [get-logic-layers] Fetching user default logic');
      
      // Get user's default logic
      const { data: userDefault, error: defaultError } = await supabase
        .from('user_default_logic')
        .select('default_agent_logic, updated_at')
        .eq('user_id', userId)
        .single();
      
      console.log('📊 [get-logic-layers] User default result:', { hasData: !!userDefault, error: defaultError });
      
      return {
        success: true,
        defaultLogic: getDefaultAgentLogic(),
        baseLogic: userDefault?.default_agent_logic || null,
        studyLogic: template?.agent_logic || null,
        lastUpdated: {
          base: userDefault?.updated_at,
          study: null // You could add a timestamp to templates table if needed
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