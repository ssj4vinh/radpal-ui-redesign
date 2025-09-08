// Remove direct supabase import - will use IPC instead
import { AgentLogic } from './types'
import buildPrompt from './buildPrompt'
import buildEnhancedPrompt from './buildEnhancedPrompt'
import buildCombinedPrompt from './buildCombinedPrompt'
import validateRules from './validateRules'
import callModel, { ModelCallResponse } from './callModel'
import { validateSectionHeaders, ensureSectionHeaders } from './validateSectionHeaders'

// Helper function to fetch global base prompt via IPC
async function getGlobalBasePrompt(): Promise<string | null> {
  try {
    const result = await window.electronAPI?.invoke('fetch-global-base-prompt')
    if (result?.success && result.basePrompt) {
      console.log('✅ Using global base prompt from database')
      return result.basePrompt
    }
  } catch (error) {
    console.error('Error fetching global base prompt:', error)
  }
  return null
}

// Helper function to fetch global prompt sections via IPC
async function getGlobalPromptSections(): Promise<{ findingsRules?: any, impressionRules?: any }> {
  try {
    const result = await window.electronAPI?.fetchGlobalPromptSections()
    console.log('🔍 Global prompt sections result:', result)
    if (result?.success) {
      console.log('✅ Using global prompt sections from database', {
        hasFindingsRules: !!result.globalFindingsRules,
        hasImpressionRules: !!result.globalImpressionRules,
        findingsRules: result.globalFindingsRules,
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
    console.log('✅ Using V2 agent logic system (base + study-specific)', {
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
        generate_prompt: templateResult.data.generate_prompt // Keep for fallback
      }
    }
  }
  
  // Fallback to old system
  console.log('⚠️ Falling back to V1 agent logic system')
  const result = await window.electron?.ipcRenderer?.invoke('fetch-template-for-generation', userId, studyType)
  
  if (!result || result.error) {
    throw new Error(result?.error || `No template found for user ${userId} and study type "${studyType}"`)
  }
  
  return result.data
}

export default async function generateReport({
  userId,
  studyType,
  findings,
  model
}: {
  userId: string
  studyType: string
  findings: string
  model?: string
}): Promise<ModelCallResponse> {
  console.log('🤖 Agent generateReport called:', { 
    userId, 
    studyType, 
    findingsLength: findings.length + ' characters',
    findingsPreview: findings.substring(0, 100) + '...', 
    model 
  })
  
  try {
    // Query templates table via IPC to avoid TLS inspection issues
    const data = await getTemplateViaIPC(userId, studyType)
    
    if (!data) {
      throw new Error(`No template found for user ${userId} and study type "${studyType}"`)
    }
    
    const { template, agent_logic: agentLogic, generate_prompt } = data
    
    // If no agent_logic exists, create fallback logic from the old generate_prompt
    let finalAgentLogic = agentLogic
    if (!agentLogic && generate_prompt) {
      console.log('🔄 Using fallback: converting generate_prompt to agent_logic')
      finalAgentLogic = {
        instructions: generate_prompt,
        version: "1.0_fallback"
      }
    }
    
    if (!template) {
      throw new Error(`Template is empty for study type "${studyType}"`)
    }
    
    // Build the prompt using combined logic for unified rule sections
    // Check if we have V2 logic structure (version 3.0 or has general/report/impression sections)
    const hasV2Logic = finalAgentLogic?.version === "3.0" || 
                       finalAgentLogic?.version === "1.0" || // Study-specific version
                       (finalAgentLogic?.general && finalAgentLogic?.report && finalAgentLogic?.impression) ||
                       (finalAgentLogic?.study_report || finalAgentLogic?.study_impression)
    
    console.log('📊 Logic detection:', {
      version: finalAgentLogic?.version,
      hasGeneral: !!finalAgentLogic?.general,
      hasReport: !!finalAgentLogic?.report,
      hasImpression: !!finalAgentLogic?.impression,
      hasStudyReport: !!finalAgentLogic?.study_report,
      hasStudyImpression: !!finalAgentLogic?.study_impression,
      hasV2Logic,
      logicKeys: finalAgentLogic ? Object.keys(finalAgentLogic) : []
    })
    
    // Fetch global base prompt
    const globalBasePrompt = await getGlobalBasePrompt()
    
    // Fetch global prompt sections
    const { findingsRules: globalFindingsRules, impressionRules: globalImpressionRules } = await getGlobalPromptSections()
    
    const prompt = hasV2Logic
      ? buildCombinedPrompt(findings, template, finalAgentLogic || {}, globalBasePrompt, globalFindingsRules, globalImpressionRules)
      : buildEnhancedPrompt(findings, template, finalAgentLogic || {})
    
    console.log(hasV2Logic 
      ? '🎯 Using combined prompt with unified rule sections'
      : '🎯 Using enhanced prompt for better rule compliance')
    
    // Call the model with the composed prompt
    const modelOutput = await callModel({ prompt, model })
    
    // Validate section headers in the generated report
    const headerValidation = validateSectionHeaders(template, modelOutput.text)
    let finalReport = modelOutput.text
    
    if (!headerValidation.valid) {
      console.warn('⚠️ Section header validation failed:', headerValidation)
      finalReport = ensureSectionHeaders(template, modelOutput.text)
    }
    
    // Validate rule compliance
    const ruleValidation = validateRules(finalReport, findings, finalAgentLogic || {})
    
    if (!ruleValidation.passed) {
      console.error('🚨 Rule validation failed:', ruleValidation.violations)
      
      // Log violations for debugging
      ruleValidation.violations.forEach(violation => {
        console.error('❌ RULE VIOLATION:', violation)
      })
      
      // Add violations as metadata (could be shown to user)
      return {
        ...modelOutput,
        text: finalReport,
        ruleViolations: ruleValidation.violations,
        ruleWarnings: ruleValidation.warnings,
        prompt: prompt // Include the final prompt for display
      }
    } else {
      console.log('✅ All rules validated successfully')
    }
    
    if (ruleValidation.warnings.length > 0) {
      console.warn('⚠️ Rule warnings:', ruleValidation.warnings)
    }
    
    return {
      ...modelOutput,
      text: finalReport,
      ruleViolations: ruleValidation.violations,
      ruleWarnings: ruleValidation.warnings,
      prompt: prompt // Include the final prompt for display
    }
  } catch (error) {
    console.error('Error generating report:', error)
    throw error
  }
}