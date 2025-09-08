/**
 * Agent logic queries using IPC (Electron bridge)
 * Avoids direct Supabase calls from renderer process
 */

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
 * Fetches both base and study-specific logic for a user via IPC
 */
export async function fetchAgentLogic(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<AgentLogicQueryResult> {
  console.log('🔍 fetchAgentLogic called:', { userId, studyType, isOfflineMode })
  
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
    
    // Use IPC to get logic layers
    console.log('🔌 Checking for IPC availability:', !!window.electronAPI, !!window.electronAPI?.getLogicLayers)
    
    if (window.electronAPI?.getLogicLayers) {
      console.log('📡 Calling IPC getLogicLayers...')
      const result = await window.electronAPI.getLogicLayers(userId, studyType)
      console.log('📥 IPC result:', result)
      
      if (result.error) {
        console.error('Error from IPC:', result.error)
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
      
      const layers: LogicLayers = {
        defaultLogic: result.defaultLogic || getDefaultAgentLogic(),
        baseLogic: result.baseLogic,
        studySpecificLogic: result.studyLogic
      }
      
      const { mergedLogic } = mergeLogicLayers(layers)
      
      // Cache in offline storage
      if (result.baseLogic) offlineStorage.saveAgentLogic('__USER_DEFAULT__', result.baseLogic)
      if (result.studyLogic) offlineStorage.saveAgentLogic(studyType, result.studyLogic)
      
      return {
        success: true,
        baseLogic: result.baseLogic,
        studyLogic: result.studyLogic,
        mergedLogic,
        lastUpdated: result.lastUpdated || {}
      }
    }
    
    // Fallback if no IPC available
    throw new Error('IPC not available')
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
 * Updates base logic via IPC
 */
export async function updateBaseLogic(
  userId: string,
  baseLogic: any,
  isOfflineMode: boolean = false
): Promise<AgentLogicQueryResult> {
  console.log('🔄 updateBaseLogic called:', { userId, hasBaseLogic: !!baseLogic, isOfflineMode })
  
  try {
    if (isOfflineMode) {
      offlineStorage.saveAgentLogic('__USER_DEFAULT__', baseLogic)
      return { success: true, baseLogic }
    }
    
    console.log('🔌 Checking for updateBaseLogic IPC:', !!window.electronAPI?.updateBaseLogic)
    
    if (window.electronAPI?.updateBaseLogic) {
      console.log('📡 Calling IPC updateBaseLogic...')
      const result = await window.electronAPI.updateBaseLogic(userId, baseLogic)
      console.log('📥 Update result:', result)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      // Cache in offline storage
      offlineStorage.saveAgentLogic('__USER_DEFAULT__', baseLogic)
      
      return { success: true, baseLogic }
    }
    
    throw new Error('IPC not available')
  } catch (error) {
    console.error('Error updating base logic:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update base logic'
    }
  }
}

/**
 * Updates study-specific logic via IPC
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
    
    if (window.electronAPI?.updateStudyLogic) {
      const result = await window.electronAPI.updateStudyLogic(userId, studyType, logicToSave)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      // Cache in offline storage
      offlineStorage.saveAgentLogic(studyType, logicToSave)
      
      return { success: true, studyLogic: logicToSave }
    }
    
    throw new Error('IPC not available')
  } catch (error) {
    console.error('Error updating study logic:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update study logic'
    }
  }
}

/**
 * Resets logic to default via IPC
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
      
      return updateStudyLogic(userId, studyType, null, isOfflineMode, false)
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
 */
export async function getMergedLogicForPrompt(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<any> {
  const result = await fetchAgentLogic(userId, studyType, isOfflineMode)
  return result.mergedLogic || getDefaultAgentLogic()
}