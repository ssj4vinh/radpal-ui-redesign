/**
 * Debug version of agent logic IPC handlers
 * Testing without authentication
 */

const { ipcMain } = require('electron');

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

// In-memory storage for testing
const mockStorage = {
  baseLogic: {},
  studyLogic: {}
};

// Register IPC handlers
function registerHandlers() {
  console.log('📝 Registering DEBUG agent logic IPC handlers');
  
  // Get current logic layers
  ipcMain.handle('get-logic-layers', async (event, userId, studyType) => {
    console.log('📨 [DEBUG] get-logic-layers called:', { userId, studyType });
    
    try {
      const defaultLogic = getDefaultAgentLogic();
      const baseLogic = mockStorage.baseLogic[userId] || null;
      const studyLogic = mockStorage.studyLogic[`${userId}_${studyType}`] || null;
      
      console.log('📥 [DEBUG] Returning logic layers:', {
        hasDefault: !!defaultLogic,
        hasBase: !!baseLogic,
        hasStudy: !!studyLogic
      });
      
      return {
        success: true,
        defaultLogic,
        baseLogic,
        studyLogic,
        lastUpdated: {
          base: baseLogic ? new Date().toISOString() : null,
          study: studyLogic ? new Date().toISOString() : null
        }
      };
    } catch (error) {
      console.error('❌ [DEBUG] Error in get-logic-layers:', error);
      return {
        error: error.message,
        defaultLogic: getDefaultAgentLogic()
      };
    }
  });
  
  // Update base logic
  ipcMain.handle('update-base-logic', async (event, userId, baseLogic) => {
    console.log('📨 [DEBUG] update-base-logic called:', { userId, hasLogic: !!baseLogic });
    
    try {
      mockStorage.baseLogic[userId] = baseLogic;
      console.log('✅ [DEBUG] Base logic saved to memory');
      
      return { success: true };
    } catch (error) {
      console.error('❌ [DEBUG] Error in update-base-logic:', error);
      return { 
        error: error.message || 'Unknown error'
      };
    }
  });
  
  // Update study-specific logic
  ipcMain.handle('update-study-logic', async (event, userId, studyType, studyLogic) => {
    console.log('📨 [DEBUG] update-study-logic called:', { userId, studyType, hasLogic: !!studyLogic });
    
    try {
      mockStorage.studyLogic[`${userId}_${studyType}`] = studyLogic;
      console.log('✅ [DEBUG] Study logic saved to memory');
      
      return { success: true };
    } catch (error) {
      console.error('❌ [DEBUG] Error in update-study-logic:', error);
      return { error: error.message };
    }
  });
  
  // Fetch merged logic for report generation
  ipcMain.handle('fetch-merged-logic', async (event, userId, studyType) => {
    console.log('📨 [DEBUG] fetch-merged-logic called:', { userId, studyType });
    
    try {
      // Start with system default
      let mergedLogic = getDefaultAgentLogic();
      
      // Apply user's base logic if exists
      const baseLogic = mockStorage.baseLogic[userId];
      if (baseLogic) {
        mergedLogic = deepMergeLogic(mergedLogic, baseLogic);
      }
      
      // Apply study-specific logic if exists
      const studyLogic = mockStorage.studyLogic[`${userId}_${studyType}`];
      if (studyLogic) {
        mergedLogic = deepMergeLogic(mergedLogic, studyLogic);
      }
      
      console.log('✅ [DEBUG] Returning merged logic');
      
      return {
        success: true,
        mergedLogic,
        hasBaseLogic: !!baseLogic,
        hasStudyLogic: !!studyLogic
      };
    } catch (error) {
      console.error('❌ [DEBUG] Error in fetch-merged-logic:', error);
      return {
        error: error.message,
        mergedLogic: getDefaultAgentLogic()
      };
    }
  });
}

module.exports = {
  initSupabase: () => {
    console.log('📝 [DEBUG] Supabase init called (no-op in debug mode)');
  },
  registerHandlers,
  getDefaultAgentLogic
};