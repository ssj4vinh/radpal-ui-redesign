// Remove direct supabase import - will use IPC instead
import { AgentLogic } from './types'
import buildImpressionPrompt from './buildImpressionPrompt'
import buildEnhancedImpressionPrompt from './buildEnhancedImpressionPrompt'
import buildCombinedImpressionPrompt from './buildCombinedImpressionPrompt'
import validateRules from './validateRules'
import callModel, { ModelCallResponse } from './callModel'
import { postProcessImpression } from './postProcessImpression'

// Helper function to fetch global impression prompt via IPC
async function getGlobalImpressionPrompt(): Promise<string | null> {
  try {
    const result = await window.electronAPI?.fetchGlobalImpressionPrompt()
    if (result?.success && result.impressionPrompt) {
      console.log('✅ Using global impression prompt from database')
      return result.impressionPrompt
    }
  } catch (error) {
    console.error('Error fetching global impression prompt:', error)
  }
  return null
}

// Helper function to fetch global prompt sections via IPC
async function getGlobalPromptSections(): Promise<{ findingsRules?: any, impressionRules?: any }> {
  try {
    const result = await window.electronAPI?.fetchGlobalPromptSections()
    console.log('🔍 Global prompt sections result for impression:', result)
    if (result?.success) {
      console.log('✅ Using global prompt sections from database for impression', {
        hasFindingsRules: !!result.globalFindingsRules,
        hasImpressionRules: !!result.globalImpressionRules,
        impressionRules: result.globalImpressionRules
      })
      return {
        findingsRules: result.globalFindingsRules,
        impressionRules: result.globalImpressionRules
      }
    }
  } catch (error) {
    console.error('Error fetching global prompt sections:', error)
  }
  return {}
}

// Helper function to get template data via IPC
async function getTemplateViaIPC(userId: string, studyType: string) {
  // First try to get V2 logic (base + study-specific)
  const v2Result = await window.electronAPI?.invoke('fetch-agent-logic-v2', userId, studyType)
  
  if (v2Result?.success) {
    console.log('✅ Using V2 agent logic system for impression (base + study-specific)', {
      hasBaseLogic: !!v2Result.baseLogic,
      hasStudyLogic: !!v2Result.studyLogic,
      hasMergedLogic: !!v2Result.mergedLogic,
      mergedKeys: v2Result.mergedLogic ? Object.keys(v2Result.mergedLogic) : []
    })
    
    // Also fetch template text
    const templateResult = await window.electron?.ipcRenderer?.invoke('fetch-template-for-generation', userId, studyType)
    if (templateResult?.data) {
      // Important: Use the V2 merged logic, not the old agent_logic from template
      return {
        template: templateResult.data.template, // Only use the template text
        agent_logic: v2Result.mergedLogic, // Use the properly merged V2 logic
        generate_impression: templateResult.data.generate_impression // Keep for fallback
      }
    }
  }
  
  // Fallback to old system
  console.log('⚠️ Falling back to V1 agent logic system for impression')
  const result = await window.electron?.ipcRenderer?.invoke('fetch-template-for-generation', userId, studyType)
  
  if (!result || result.error) {
    throw new Error(result?.error || `No template found for user ${userId} and study type "${studyType}"`)
  }
  
  return result.data
}

export default async function generateImpression({
  userId,
  studyType,
  findings,
  model
}: {
  userId: string
  studyType: string  // studyType is required
  findings: string
  model?: string
}): Promise<ModelCallResponse> {
  try {
    // Query templates table via IPC to avoid TLS inspection issues
    const data = await getTemplateViaIPC(userId, studyType)
    
    if (!data) {
      throw new Error(`No template found for user ${userId} and study type "${studyType}"`)
    }
    
    const { template, agent_logic: agentLogic, generate_impression } = data
    
    // If no agent_logic exists, create fallback logic from the old generate_impression
    let finalAgentLogic = agentLogic
    if (!agentLogic && generate_impression) {
      console.log('🔄 Using fallback: converting generate_impression to agent_logic')
      finalAgentLogic = {
        instructions: generate_impression,
        version: "1.0_fallback",
        impression: {
          concise_summary: true
        }
      }
    }
    
    // Build the prompt using combined logic for unified rule sections
    // Check if we have V2 logic structure (version 3.0 or has general/report/impression sections)
    const hasV2Logic = finalAgentLogic?.version === "3.0" || 
                       finalAgentLogic?.version === "1.0" || // Study-specific version
                       (finalAgentLogic?.general && finalAgentLogic?.report && finalAgentLogic?.impression) ||
                       (finalAgentLogic?.study_report || finalAgentLogic?.study_impression)
    
    console.log('📊 Impression logic detection:', {
      version: finalAgentLogic?.version,
      hasGeneral: !!finalAgentLogic?.general,
      hasReport: !!finalAgentLogic?.report,
      hasImpression: !!finalAgentLogic?.impression,
      hasStudyReport: !!finalAgentLogic?.study_report,
      hasStudyImpression: !!finalAgentLogic?.study_impression,
      hasV2Logic,
      logicKeys: finalAgentLogic ? Object.keys(finalAgentLogic) : []
    })
    
    // Fetch global impression base prompt if available
    let globalImpressionPrompt = undefined
    if ((window as any).electronAPI?.fetchGlobalImpressionPrompt) {
      try {
        const result = await (window as any).electronAPI.fetchGlobalImpressionPrompt()
        if (result.success && result.impressionPrompt) {
          globalImpressionPrompt = result.impressionPrompt
          console.log('📝 Using global impression base prompt')
        }
      } catch (error) {
        console.log('Could not fetch global impression prompt, using default:', error)
      }
    }
    
    // Fetch global impression rules for standalone impression generation
    const { impressionRules: globalImpressionRules } = await getGlobalPromptSections()
    
    const prompt = hasV2Logic
      ? buildCombinedImpressionPrompt(findings, template || '', finalAgentLogic || {}, globalImpressionPrompt, globalImpressionRules)
      : buildEnhancedImpressionPrompt(findings, template || '', finalAgentLogic || {})
    
    console.log(hasV2Logic 
      ? '🎯 Using combined impression prompt with unified rules'
      : '🎯 Using enhanced impression prompt for better formatting and rule compliance')
    
    // Call the model with the composed prompt
    const modelOutput = await callModel({ prompt, model })
    
    // POST-PROCESS: Apply strict exclusion rules to the generated text
    console.log('🔧 Post-processing impression to enforce exclusion rules...')
    const processedText = postProcessImpression(modelOutput.text, finalAgentLogic || {})
    
    // Check if post-processing removed anything
    if (processedText !== modelOutput.text) {
      console.log('✂️ Post-processing removed excluded items from impression')
    }
    
    // Update the model output with processed text
    modelOutput.text = processedText
    
    // Validate rule compliance for impressions
    const ruleValidation = validateRules(processedText, findings, finalAgentLogic || {})
    
    if (!ruleValidation.passed) {
      console.error('🚨 Impression rule validation failed:', ruleValidation.violations)
      
      // Log violations for debugging
      ruleValidation.violations.forEach(violation => {
        console.error('❌ IMPRESSION RULE VIOLATION:', violation)
      })
    } else {
      console.log('✅ All impression rules validated successfully')
    }
    
    if (ruleValidation.warnings.length > 0) {
      console.warn('⚠️ Impression rule warnings:', ruleValidation.warnings)
    }
    
    return {
      ...modelOutput,
      ruleViolations: ruleValidation.violations,
      ruleWarnings: ruleValidation.warnings,
      prompt: prompt // Include the final prompt for display
    }
  } catch (error) {
    console.error('Error generating impression:', error)
    throw error
  }
}