// IPC queries for agent logic v2 (uses agent_logic_2 column for study-specific logic)

import { getDefaultStandardizedLogic, getDefaultStudySpecificLogic } from '../utils/standardizedLogicSchema';

interface AgentLogicV2Result {
  success: boolean;
  baseLogic?: any;
  studyLogic?: any;
  mergedLogic?: any;
  legacyLogic?: any;
  error?: string;
}

// Fetch agent logic v2
export async function fetchAgentLogicV2(
  userId: string,
  studyType: string,
  isOfflineMode: boolean = false
): Promise<AgentLogicV2Result> {
  try {
    if (isOfflineMode) {
      // In offline mode, return defaults
      return {
        success: true,
        baseLogic: getDefaultStandardizedLogic(),
        studyLogic: getDefaultStudySpecificLogic(),
        mergedLogic: {
          ...getDefaultStandardizedLogic(),
          ...getDefaultStudySpecificLogic()
        }
      };
    }
    
    if (window.electronAPI?.invoke) {
      const result = await window.electronAPI.invoke('fetch-agent-logic-v2', userId, studyType);
      
      console.log('🔍 CLIENT RECEIVED FROM IPC:', {
        success: result?.success,
        hasBaseLogic: !!result?.baseLogic,
        hasStudyLogic: !!result?.studyLogic,
        hasMergedLogic: !!result?.mergedLogic,
        hasLegacyLogic: !!result?.legacyLogic,
        baseLogicKeys: result?.baseLogic ? Object.keys(result.baseLogic) : [],
        studyLogicKeys: result?.studyLogic ? Object.keys(result.studyLogic) : [],
        mergedLogicKeys: result?.mergedLogic ? Object.keys(result.mergedLogic) : [],
        baseLogicSample: result?.baseLogic ? JSON.stringify(result.baseLogic).substring(0, 200) : 'null'
      });
      
      // Log full base logic to see what we got
      if (result?.baseLogic) {
        console.log('📦 Full baseLogic received:', result.baseLogic);
      }
      if (result?.mergedLogic) {
        console.log('📦 Full mergedLogic received:', result.mergedLogic);
      }
      
      return result;
    }
    
    throw new Error('Electron API not available');
  } catch (error) {
    console.error('Error fetching agent logic v2:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch logic'
    };
  }
}

// Update base logic v2
export async function updateBaseLogicV2(
  userId: string,
  baseLogic: any,
  isOfflineMode: boolean = false
): Promise<AgentLogicV2Result> {
  try {
    if (isOfflineMode) {
      // In offline mode, just return success
      return { success: true, baseLogic };
    }
    
    if (window.electronAPI?.invoke) {
      const result = await window.electronAPI.invoke('update-base-logic-v2', userId, baseLogic);
      return result;
    }
    
    throw new Error('Electron API not available');
  } catch (error) {
    console.error('Error updating base logic v2:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update base logic'
    };
  }
}

// Update study logic v2
export async function updateStudyLogicV2(
  userId: string,
  studyType: string,
  studyLogic: any,
  isOfflineMode: boolean = false
): Promise<AgentLogicV2Result> {
  try {
    if (isOfflineMode) {
      // In offline mode, just return success
      return { success: true, studyLogic };
    }
    
    if (window.electronAPI?.invoke) {
      const result = await window.electronAPI.invoke('update-study-logic-v2', userId, studyType, studyLogic);
      return result;
    }
    
    throw new Error('Electron API not available');
  } catch (error) {
    console.error('Error updating study logic v2:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update study logic'
    };
  }
}

// Reset logic to defaults
export async function resetLogicV2(
  userId: string,
  studyType: string,
  resetType: 'base' | 'study',
  isOfflineMode: boolean = false
): Promise<AgentLogicV2Result> {
  try {
    if (isOfflineMode) {
      return { success: true };
    }
    
    if (window.electronAPI?.invoke) {
      const result = await window.electronAPI.invoke('reset-logic-v2', userId, studyType, resetType);
      return result;
    }
    
    throw new Error('Electron API not available');
  } catch (error) {
    console.error('Error resetting logic v2:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset logic'
    };
  }
}