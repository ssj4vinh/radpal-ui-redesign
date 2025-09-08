// Agent logic updates using IPC to bypass TLS inspection

export async function updateAgentLogic(
  userId: string,
  studyType: string,
  delta: any
): Promise<{ success: boolean; error?: string; finalLogic?: any }> {
  try {
    if (!userId || !studyType?.trim()) {
      throw new Error('User ID and study type are required')
    }

    console.log('🔧 Updating agent logic via IPC:', { userId, studyType })

    // Use IPC to update agent logic
    const result = await window.electron?.ipcRenderer?.invoke('agent-logic-update', userId, studyType, delta)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    console.log('✅ Agent logic updated successfully via IPC')
    return { success: true, finalLogic: result.finalLogic }
  } catch (error) {
    console.error('❌ updateAgentLogic failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function resetAgentLogicToDefault(
  userId: string,
  studyType: string
): Promise<{ success: boolean; error?: string; finalLogic?: any }> {
  try {
    if (!userId || !studyType?.trim()) {
      throw new Error('User ID and study type are required')
    }

    console.log('🔄 Resetting agent logic to default via IPC:', { userId, studyType })

    // Use IPC to reset agent logic
    const result = await window.electron?.ipcRenderer?.invoke('agent-logic-reset', userId, studyType)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    console.log('✅ Agent logic reset successfully via IPC')
    return { success: true, finalLogic: result.finalLogic }
  } catch (error) {
    console.error('❌ resetAgentLogicToDefault failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getCurrentAgentLogic(
  userId: string,
  studyType: string
): Promise<{ logic: any | null; error?: string }> {
  try {
    if (!userId || !studyType?.trim()) {
      throw new Error('User ID and study type are required')
    }

    console.log('📖 Getting current agent logic via IPC:', { userId, studyType })

    // Use IPC to get current agent logic
    const result = await window.electron?.ipcRenderer?.invoke('agent-logic-get-current', userId, studyType)
    
    if (result?.error) {
      throw new Error(result.error)
    }

    return { logic: result.logic }
  } catch (error) {
    console.error('❌ getCurrentAgentLogic failed:', error)
    return { 
      logic: null, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}