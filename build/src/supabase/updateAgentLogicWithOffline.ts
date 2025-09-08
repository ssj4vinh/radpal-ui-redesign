import { supabase } from '../lib/supabase'
import { deepMergeAgentLogic, getDefaultAgentLogic } from '../utils/logicMerge'
import { offlineStorage } from '../services/offlineStorage'
import { updateAgentLogic as updateAgentLogicIPC, resetAgentLogicToDefault as resetAgentLogicToDefaultIPC, getCurrentAgentLogic as getCurrentAgentLogicIPC } from './updateAgentLogicIPC'

export interface UpdateAgentLogicResult {
  success: boolean
  error?: string
  finalLogic?: any
}

/**
 * Updates agent_logic for a specific user and study type with offline fallback
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @param delta - The changes to merge into existing logic
 * @param isOfflineMode - Whether to use offline storage only
 * @returns Promise with success status and final merged logic
 */
export async function updateAgentLogicWithOffline(
  userId: string,
  studyType: string,
  delta: any,
  isOfflineMode: boolean = false
): Promise<UpdateAgentLogicResult> {
  try {
    let currentLogic = getDefaultAgentLogic()

    if (isOfflineMode) {
      // Use offline storage
      console.log('💾 Updating agent logic in offline mode')
      currentLogic = offlineStorage.getAgentLogic(studyType) || getDefaultAgentLogic()
      
      // Deep merge the delta with current logic
      const finalLogic = deepMergeAgentLogic(currentLogic, delta)
      
      // Save to offline storage
      offlineStorage.saveAgentLogic(studyType, finalLogic)
      
      return {
        success: true,
        finalLogic
      }
    }

    // Try to use IPC if available (Electron environment)
    if (window.electron?.ipcRenderer) {
      try {
        console.log('🔌 Using IPC to update agent logic')
        const result = await window.electron.ipcRenderer.invoke('agent-logic-update', userId, studyType, delta)
        
        if (result.success) {
          console.log('✅ Successfully updated agent_logic via IPC')
          // Save to offline storage as backup
          offlineStorage.saveAgentLogic(studyType, result.finalLogic)
          return result
        } else {
          throw new Error(result.error || 'IPC update failed')
        }
      } catch (ipcError) {
        console.log('⚠️ IPC failed, falling back to direct Supabase query:', ipcError)
        // Fall through to direct Supabase query
      }
    }

    // Try online mode with direct Supabase query (fallback)
    try {
      // First, fetch the current templates (not using .single() to avoid errors)
      const { data: templates, error: fetchError } = await supabase
        .from('templates')
        .select('id, agent_logic, study_type')  // Select more fields to ensure we find the template
        .eq('user_id', userId)
        .eq('study_type', studyType.trim())

      if (fetchError) {
        throw new Error(`Failed to fetch current logic: ${fetchError.message}`)
      }

      // Get current logic or use default if none exists
      currentLogic = (templates && templates.length > 0) 
        ? (templates[0]?.agent_logic || getDefaultAgentLogic())
        : getDefaultAgentLogic()

      // Deep merge the delta with current logic
      const finalLogic = deepMergeAgentLogic(currentLogic, delta)
      

      // Check if template exists
      if (!templates || templates.length === 0) {
        console.log('❌ No template found for user:', userId, 'and study type:', studyType)
        throw new Error(`No template found for study type "${studyType}". The template should exist but wasn't found for user ${userId}`)
      } else {
        // Update the existing template's agent_logic column
        const { error: updateError } = await supabase
          .from('templates')
          .update({ agent_logic: finalLogic })
          .eq('user_id', userId)
          .eq('study_type', studyType.trim())

        if (updateError) {
          throw new Error(`Failed to update logic: ${updateError.message}`)
        }
        
        console.log('✅ Successfully updated existing template with agent_logic')
      }
      

      // Save to offline storage as backup
      offlineStorage.saveAgentLogic(studyType, finalLogic)

      return {
        success: true,
        finalLogic
      }
    } catch (error) {
      console.log('⚠️ Failed to update logic online, falling back to offline mode')
      
      // Fallback to offline storage
      currentLogic = offlineStorage.getAgentLogic(studyType) || getDefaultAgentLogic()
      const finalLogic = deepMergeAgentLogic(currentLogic, delta)
      offlineStorage.saveAgentLogic(studyType, finalLogic)
      
      return {
        success: true,
        finalLogic
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Resets agent_logic to default for a specific user and study type with offline fallback
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @param isOfflineMode - Whether to use offline storage only
 * @returns Promise with success status and default logic
 */
export async function resetAgentLogicToDefaultWithOffline(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<UpdateAgentLogicResult> {
  try {
    const defaultLogic = getDefaultAgentLogic()

    if (isOfflineMode) {
      // Use offline storage
      console.log('💾 Resetting agent logic to default in offline mode')
      offlineStorage.saveAgentLogic(studyType, defaultLogic)
      
      return {
        success: true,
        finalLogic: defaultLogic
      }
    }

    // Try to use IPC if available (Electron environment)
    if (window.electron?.ipcRenderer) {
      try {
        console.log('🔌 Using IPC to reset agent logic')
        const result = await window.electron.ipcRenderer.invoke('agent-logic-reset', userId, studyType)
        
        if (result.success) {
          console.log('✅ Successfully reset agent_logic via IPC')
          // Save to offline storage as backup
          offlineStorage.saveAgentLogic(studyType, result.finalLogic)
          return result
        } else {
          throw new Error(result.error || 'IPC reset failed')
        }
      } catch (ipcError) {
        console.log('⚠️ IPC failed, falling back to direct Supabase query:', ipcError)
        // Fall through to direct Supabase query
      }
    }

    // Try online mode with direct Supabase query (fallback)
    try {
      // First check if the template exists
      const { data: templates, error: fetchError } = await supabase
        .from('templates')
        .select('id, study_type')  // Select more fields to ensure we find the template
        .eq('user_id', userId)
        .eq('study_type', studyType.trim())

      if (fetchError) {
        throw new Error(`Failed to check template: ${fetchError.message}`)
      }

      if (!templates || templates.length === 0) {
        console.log('❌ No template found for user:', userId, 'and study type:', studyType)
        throw new Error(`No template found for study type "${studyType}". The template should exist but wasn't found for user ${userId}`)
      } else {
        const { error: updateError } = await supabase
          .from('templates')
          .update({ agent_logic: defaultLogic })
          .eq('user_id', userId)
          .eq('study_type', studyType.trim())

        if (updateError) {
          throw new Error(`Failed to reset logic: ${updateError.message}`)
        }
        
        console.log('✅ Successfully reset existing template to default logic')
      }

      // Save to offline storage as backup
      offlineStorage.saveAgentLogic(studyType, defaultLogic)

      return {
        success: true,
        finalLogic: defaultLogic
      }
    } catch (error) {
      console.log('⚠️ Failed to reset logic online, falling back to offline mode')
      
      // Fallback to offline storage
      offlineStorage.saveAgentLogic(studyType, defaultLogic)
      
      return {
        success: true,
        finalLogic: defaultLogic
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Fetches current agent_logic for a user and study type with offline fallback
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @param isOfflineMode - Whether to use offline storage only
 * @returns Promise with current logic or default if none exists
 */
export async function getCurrentAgentLogicWithOffline(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<{ logic: any; error?: string }> {
  try {
    // First check if the study type is valid (not empty or just whitespace)
    if (!studyType || !studyType.trim()) {
      return {
        logic: null,
        error: 'Study type is required'
      }
    }

    if (isOfflineMode) {
      // Use offline storage
      console.log('📦 Getting agent logic from offline storage')
      const logic = offlineStorage.getAgentLogic(studyType) || getDefaultAgentLogic()
      return { logic }
    }

    // Try to use IPC if available (Electron environment)
    if (window.electron?.ipcRenderer) {
      try {
        console.log('🔌 Using IPC to get current agent logic')
        const result = await window.electron.ipcRenderer.invoke('agent-logic-get-current', userId, studyType)
        
        if (result.logic) {
          console.log('✅ Successfully fetched agent_logic via IPC')
          console.log('📥 numerically_itemized from IPC:', result.logic?.impression?.numerically_itemized)
          // Save to offline storage as backup
          offlineStorage.saveAgentLogic(studyType, result.logic)
          return { logic: result.logic }
        } else if (result.error) {
          console.log('⚠️ IPC returned error:', result.error)
          // Don't throw, just fall through to try direct query
        }
      } catch (ipcError) {
        console.log('⚠️ IPC failed, falling back to direct Supabase query:', ipcError)
        // Fall through to direct Supabase query
      }
    }

    // Try online mode with direct Supabase query (fallback)
    try {
      console.log('🌐 Fetching logic from Supabase for:', { userId, studyType });
      console.log('  - userId:', userId);
      console.log('  - studyType:', studyType);
      console.log('  - studyType.trim():', studyType.trim());
      console.log('  - studyType length:', studyType.trim().length);
      
      const { data: templates, error } = await supabase
        .from('templates')
        .select('id, agent_logic, study_type, user_id')  // Select more fields including user_id for debugging
        .eq('user_id', userId)
        .eq('study_type', studyType.trim())

      if (error) {
        console.error('🚨 Supabase query error:', error);
        throw new Error(`Failed to fetch logic: ${error.message}`)
      }

      console.log('  - Templates found:', templates?.length || 0);
      console.log('  - First template:', templates?.[0] ? {
        id: templates[0].id,
        study_type: templates[0].study_type,
        user_id: templates[0].user_id,
        has_agent_logic: !!templates[0].agent_logic
      } : 'none');
      
      // Let's also try a broader query to see what templates exist for this user
      const { data: allUserTemplates } = await supabase
        .from('templates')
        .select('id, study_type, user_id')
        .eq('user_id', userId)
        .limit(10);
        
      
      // Also check without user_id filter to see if templates exist at all
      const { data: allTemplatesAnyUser } = await supabase
        .from('templates')
        .select('id, study_type, user_id')
        .eq('study_type', studyType.trim())
        .limit(5);
        
      console.log('  - Total found:', allTemplatesAnyUser?.length || 0);
      if (allTemplatesAnyUser && allTemplatesAnyUser.length > 0) {
        console.log('  - User IDs:', allTemplatesAnyUser.map(t => t.user_id).join(', '));
        console.log('  - First template user_id:', allTemplatesAnyUser[0].user_id);
        console.log('  - Current user_id:', userId);
        console.log('  - IDs match?:', allTemplatesAnyUser[0].user_id === userId);
      }

      let logic
      
      // Handle no templates found - return default logic
      if (!templates || templates.length === 0) {
        console.log('📭 No templates found, using default logic');
        logic = getDefaultAgentLogic()
      } else {
        // Handle multiple templates found (shouldn't happen, but be defensive)
        if (templates.length > 1) {
          console.warn(`Multiple templates found for user ${userId} and study type ${studyType}. Using the first one.`)
        }
        
        // Get the stored logic and merge with defaults to ensure all properties exist
        const storedLogic = templates[0]?.agent_logic
        if (storedLogic) {
          // Merge stored logic with defaults to ensure all expected properties are present
          logic = deepMergeAgentLogic(getDefaultAgentLogic(), storedLogic)
          console.log('📥 Merged stored logic with defaults:', logic);
        } else {
          // No stored logic, use defaults
          logic = getDefaultAgentLogic()
          console.log('📥 Using default logic (no stored logic found):', logic);
        }
        console.log('📥 numerically_itemized from final logic:', logic?.impression?.numerically_itemized);
      }

      // Save to offline storage as backup
      offlineStorage.saveAgentLogic(studyType, logic)

      return { logic }
    } catch (error) {
      console.log('⚠️ Failed to fetch logic online, falling back to offline mode')
      
      // Fallback to offline storage
      const logic = offlineStorage.getAgentLogic(studyType) || getDefaultAgentLogic()
      return { logic }
    }
  } catch (error) {
    return {
      logic: null,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}