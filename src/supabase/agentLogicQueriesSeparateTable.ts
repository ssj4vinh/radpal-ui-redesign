/**
 * Supabase queries for agent logic with inheritance support
 * Using separate table for user default logic
 */

import { supabase } from '../lib/supabase'
import { mergeLogicLayers, extractLogicDelta, LogicLayers } from '../utils/logicInheritance'
import { getDefaultAgentLogic } from '../utils/logicMerge'
import { offlineStorage } from '../services/offlineStorage'

export interface AgentLogicQueryResult {
  success: boolean
  error?: string
  baseLogic?: any
  studyLogic?: any
  mergedLogic?: any
  lastUpdated?: {
    base?: string
    study?: string
  }
}

/**
 * Fetches both base and study-specific logic for a user
 * Base logic comes from user_default_logic table (one per user)
 * Study logic comes from templates table
 */
export async function fetchAgentLogic(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<AgentLogicQueryResult> {
  try {
    if (isOfflineMode) {
      // Offline mode: get from local storage
      const baseLogic = offlineStorage.getAgentLogic('__USER_DEFAULT__') || null
      const studyLogic = offlineStorage.getAgentLogic(studyType) || null
      
      const layers: LogicLayers = {
        defaultLogic: getDefaultAgentLogic(),
        baseLogic,
        studySpecificLogic: studyLogic
      }
      
      const { mergedLogic } = mergeLogicLayers(layers)
      
      return {
        success: true,
        baseLogic,
        studyLogic,
        mergedLogic
      }
    }
    
    // Online mode: fetch from Supabase
    // Get study-specific logic from templates table
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('agent_logic')
      .eq('user_id', userId)
      .eq('study_type', studyType)
      .single()
    
    if (templateError && templateError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('Error fetching template:', templateError)
    }
    
    // Get user's default logic from separate table
    const { data: userDefault, error: defaultError } = await supabase
      .from('user_default_logic')
      .select('default_agent_logic, updated_at')
      .eq('user_id', userId)
      .single()
    
    if (defaultError && defaultError.code !== 'PGRST116') {
      console.warn('No user default logic found, will use system defaults')
    }
    
    const baseLogic = userDefault?.default_agent_logic || null
    const studyLogic = template?.agent_logic || null
    
    const layers: LogicLayers = {
      defaultLogic: getDefaultAgentLogic(),
      baseLogic,
      studySpecificLogic: studyLogic
    }
    
    const { mergedLogic } = mergeLogicLayers(layers)
    
    // Cache in offline storage
    if (baseLogic) offlineStorage.saveAgentLogic('__USER_DEFAULT__', baseLogic)
    if (studyLogic) offlineStorage.saveAgentLogic(studyType, studyLogic)
    
    return {
      success: true,
      baseLogic,
      studyLogic,
      mergedLogic,
      lastUpdated: {
        base: userDefault?.updated_at,
        study: null // Could add timestamp to templates table if needed
      }
    }
  } catch (error) {
    console.error('Error fetching agent logic:', error)
    
    // Fallback to offline storage
    const baseLogic = offlineStorage.getAgentLogic('__USER_DEFAULT__') || null
    const studyLogic = offlineStorage.getAgentLogic(studyType) || null
    
    const layers: LogicLayers = {
      defaultLogic: getDefaultAgentLogic(),
      baseLogic,
      studySpecificLogic: studyLogic
    }
    
    const { mergedLogic } = mergeLogicLayers(layers)
    
    return {
      success: true,
      baseLogic,
      studyLogic,
      mergedLogic
    }
  }
}

/**
 * Updates base logic that applies to all study types
 * Stored in user_default_logic table (one row per user)
 */
export async function updateBaseLogic(
  userId: string,
  baseLogic: any,
  isOfflineMode: boolean = false
): Promise<AgentLogicQueryResult> {
  try {
    if (isOfflineMode) {
      offlineStorage.saveAgentLogic('__USER_DEFAULT__', baseLogic)
      return { success: true, baseLogic }
    }
    
    // Check if user already has default logic
    const { data: existing } = await supabase
      .from('user_default_logic')
      .select('id')
      .eq('user_id', userId)
      .single()
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('user_default_logic')
        .update({ 
          default_agent_logic: baseLogic,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      if (error) throw error
    } else {
      // Insert new
      const { error } = await supabase
        .from('user_default_logic')
        .insert({ 
          user_id: userId,
          default_agent_logic: baseLogic
        })
      
      if (error) throw error
    }
    
    // Cache in offline storage
    offlineStorage.saveAgentLogic('__USER_DEFAULT__', baseLogic)
    
    return { success: true, baseLogic }
  } catch (error) {
    console.error('Error updating base logic:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update base logic'
    }
  }
}

/**
 * Updates study-specific logic (only the delta from base)
 * Stored in templates table agent_logic column
 */
export async function updateStudyLogic(
  userId: string,
  studyType: string,
  studyLogic: any,
  isOfflineMode: boolean = false,
  saveDeltaOnly: boolean = true
): Promise<AgentLogicQueryResult> {
  try {
    let logicToSave = studyLogic
    
    // If saveDeltaOnly, extract only the differences from base logic
    if (saveDeltaOnly) {
      const { baseLogic } = await fetchAgentLogic(userId, studyType, isOfflineMode)
      if (baseLogic) {
        const defaultLogic = getDefaultAgentLogic()
        const effectiveBase = { ...defaultLogic, ...baseLogic }
        logicToSave = extractLogicDelta(effectiveBase, studyLogic)
      }
    }
    
    if (isOfflineMode) {
      offlineStorage.saveAgentLogic(studyType, logicToSave)
      return { success: true, studyLogic: logicToSave }
    }
    
    const { error } = await supabase
      .from('templates')
      .update({ 
        agent_logic: logicToSave
      })
      .eq('user_id', userId)
      .eq('study_type', studyType)
    
    if (error) throw error
    
    // Cache in offline storage
    offlineStorage.saveAgentLogic(studyType, logicToSave)
    
    return { success: true, studyLogic: logicToSave }
  } catch (error) {
    console.error('Error updating study logic:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update study logic'
    }
  }
}

/**
 * Resets logic to default (either base or study-specific)
 */
export async function resetLogic(
  userId: string,
  studyType: string,
  resetType: 'base' | 'study',
  isOfflineMode: boolean = false
): Promise<AgentLogicQueryResult> {
  try {
    if (resetType === 'base') {
      // Reset base logic to system default
      const defaultLogic = getDefaultAgentLogic()
      return updateBaseLogic(userId, defaultLogic, isOfflineMode)
    } else {
      // Clear study-specific logic (will use base logic only)
      if (isOfflineMode) {
        offlineStorage.saveAgentLogic(studyType, null)
        return { success: true, studyLogic: null }
      }
      
      const { error } = await supabase
        .from('templates')
        .update({ 
          agent_logic: null
        })
        .eq('user_id', userId)
        .eq('study_type', studyType)
      
      if (error) throw error
      
      // Clear from offline storage
      offlineStorage.saveAgentLogic(studyType, null)
      
      return { success: true, studyLogic: null }
    }
  } catch (error) {
    console.error('Error resetting logic:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset logic'
    }
  }
}

/**
 * Gets merged logic ready for GPT prompt generation
 * This is what should be used when generating reports
 */
export async function getMergedLogicForPrompt(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<any> {
  const result = await fetchAgentLogic(userId, studyType, isOfflineMode)
  return result.mergedLogic || getDefaultAgentLogic()
}