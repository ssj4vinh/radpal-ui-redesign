import { supabase } from '../lib/supabase'
import { deepMergeAgentLogic, getDefaultAgentLogic } from '../utils/logicMerge'

export interface UpdateAgentLogicResult {
  success: boolean
  error?: string
  finalLogic?: any
}

/**
 * Updates agent_logic for a specific user and study type
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @param delta - The changes to merge into existing logic
 * @returns Promise with success status and final merged logic
 */
export async function updateAgentLogic(
  userId: string,
  studyType: string,
  delta: any
): Promise<UpdateAgentLogicResult> {
  try {
    // First, fetch the current templates (not using .single() to avoid errors)
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('agent_logic')
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch current logic: ${fetchError.message}`
      }
    }

    // Get current logic or use default if none exists
    const currentLogic = (templates && templates.length > 0) 
      ? (templates[0]?.agent_logic || getDefaultAgentLogic())
      : getDefaultAgentLogic()

    // Deep merge the delta with current logic
    const finalLogic = deepMergeAgentLogic(currentLogic, delta)

    // Check if template exists, if not we need to create one
    if (!templates || templates.length === 0) {
      return {
        success: false,
        error: `No template found for study type "${studyType}". Please create a template for this study type first through the template manager.`
      }
    }

    // Update the agent_logic column
    const { error: updateError } = await supabase
      .from('templates')
      .update({ agent_logic: finalLogic })
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (updateError) {
      return {
        success: false,
        error: `Failed to update logic: ${updateError.message}`
      }
    }

    return {
      success: true,
      finalLogic
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Resets agent_logic to default for a specific user and study type
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @returns Promise with success status and default logic
 */
export async function resetAgentLogicToDefault(
  userId: string,
  studyType: string
): Promise<UpdateAgentLogicResult> {
  try {
    // First check if the template exists
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('id')
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (fetchError) {
      return {
        success: false,
        error: `Failed to check template: ${fetchError.message}`
      }
    }

    if (!templates || templates.length === 0) {
      return {
        success: false,
        error: `No template found for study type "${studyType}". Please create a template for this study type first through the template manager.`
      }
    }

    const defaultLogic = getDefaultAgentLogic()

    const { error: updateError } = await supabase
      .from('templates')
      .update({ agent_logic: defaultLogic })
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (updateError) {
      return {
        success: false,
        error: `Failed to reset logic: ${updateError.message}`
      }
    }

    return {
      success: true,
      finalLogic: defaultLogic
    }
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Fetches current agent_logic for a user and study type
 * @param userId - The user's ID
 * @param studyType - The study type (e.g., "MRI Knee")
 * @returns Promise with current logic or default if none exists
 */
export async function getCurrentAgentLogic(
  userId: string,
  studyType: string
): Promise<{ logic: any; error?: string }> {
  try {
    // First check if the study type is valid (not empty or just whitespace)
    if (!studyType || !studyType.trim()) {
      return {
        logic: null,
        error: 'Study type is required'
      }
    }

    const { data: templates, error } = await supabase
      .from('templates')
      .select('agent_logic')
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (error) {
      return {
        logic: null,
        error: `Failed to fetch logic: ${error.message}`
      }
    }

    // Handle no templates found - return default logic
    if (!templates || templates.length === 0) {
      return {
        logic: getDefaultAgentLogic()
      }
    }

    // Handle multiple templates found (shouldn't happen, but be defensive)
    if (templates.length > 1) {
      console.warn(`Multiple templates found for user ${userId} and study type ${studyType}. Using the first one.`)
    }

    // Return the agent_logic or default if none exists
    return {
      logic: templates[0]?.agent_logic || getDefaultAgentLogic()
    }
  } catch (error) {
    return {
      logic: null,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}