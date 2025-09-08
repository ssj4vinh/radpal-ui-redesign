/**
 * Enhanced Report Generation with Logic Inheritance
 * Uses merged logic from base + study-specific layers
 */

import { AgentLogic } from './types'
import buildPrompt from './buildPrompt'
import buildEnhancedPrompt from './buildEnhancedPrompt'
import validateRules from './validateRules'
import callModel, { ModelCallResponse } from './callModel'
import { validateSectionHeaders, ensureSectionHeaders } from './validateSectionHeaders'

// Helper function to get merged logic via IPC
async function getMergedLogicViaIPC(userId: string, studyType: string) {
  // Use IPC bridge to get merged logic from main process
  const result = await window.electron?.ipcRenderer?.invoke('fetch-merged-logic', userId, studyType)
  
  if (!result || result.error) {
    throw new Error(result?.error || `Failed to get merged logic for ${studyType}`)
  }
  
  return result
}

// Helper function to get template data via IPC (backward compatible)
async function getTemplateViaIPC(userId: string, studyType: string) {
  const result = await window.electron?.ipcRenderer?.invoke('fetch-template-for-generation', userId, studyType)
  
  if (!result || result.error) {
    throw new Error(result?.error || `No template found for user ${userId} and study type "${studyType}"`)
  }
  
  return result.data
}

export default async function generateReportEnhanced({
  userId,
  studyType,
  findings,
  model,
  useEnhancedLogic = true // Flag to use new inheritance system
}: {
  userId: string
  studyType: string
  findings: string
  model?: string
  useEnhancedLogic?: boolean
}): Promise<ModelCallResponse> {
  console.log('🤖 Enhanced Agent generateReport called:', { 
    userId, 
    studyType, 
    findingsLength: findings.length + ' characters',
    findingsPreview: findings.substring(0, 100) + '...', 
    model,
    useEnhancedLogic
  })
  
  try {
    let template: string
    let agentLogic: any
    let generate_prompt: string | undefined
    
    if (useEnhancedLogic) {
      // New path: Get merged logic and template separately
      const mergedResult = await getMergedLogicViaIPC(userId, studyType)
      agentLogic = mergedResult.mergedLogic
      
      // Still need to get the template structure
      const templateData = await getTemplateViaIPC(userId, studyType)
      template = templateData.template
      generate_prompt = templateData.generate_prompt // For fallback
      
      console.log('✅ Using merged logic from inheritance system')
    } else {
      // Old path: Get everything from template (backward compatible)
      const data = await getTemplateViaIPC(userId, studyType)
      
      if (!data) {
        throw new Error(`No template found for user ${userId} and study type "${studyType}"`)
      }
      
      template = data.template
      agentLogic = data.agent_logic
      generate_prompt = data.generate_prompt
      
      console.log('⚠️ Using legacy logic from template')
    }
    
    // If no agent_logic exists, create fallback logic from the old generate_prompt
    if (!agentLogic && generate_prompt) {
      console.log('⚠️ No agent_logic found, generating fallback from generate_prompt')
      agentLogic = createFallbackLogicFromPrompt(generate_prompt)
    }
    
    if (!agentLogic) {
      console.error('❌ No agent_logic available - using minimal defaults')
      agentLogic = getMinimalDefaultLogic()
    }
    
    console.log('📋 Template found:', { 
      studyType, 
      hasTemplate: !!template, 
      hasAgentLogic: !!agentLogic,
      templateLength: template?.length || 0 
    })
    console.log('🧠 Agent logic:', JSON.stringify(agentLogic, null, 2))
    
    // Choose which prompt builder to use based on agent_logic version
    const isEnhancedLogic = agentLogic?.version === '2.0' || agentLogic?.version === 2.0
    console.log(`🔧 Using ${isEnhancedLogic ? 'enhanced' : 'standard'} prompt builder (version: ${agentLogic?.version})`)
    
    // Build the prompt with the template and logic
    const prompt = isEnhancedLogic 
      ? buildEnhancedPrompt(findings, template, agentLogic)
      : buildPrompt(findings, template, agentLogic)
    
    console.log('📝 Generated prompt length:', prompt.length, 'characters')
    console.log('📝 First 500 chars of prompt:', prompt.substring(0, 500))
    
    // Call the model
    const response = await callModel(prompt, model)
    console.log('🎯 Model response received, length:', response.content.length)
    
    // Validate the response
    const validationResult = validateRules(response.content, agentLogic)
    console.log('✅ Validation result:', validationResult)
    
    // Validate section headers if strict mode is enabled
    if (agentLogic?.formatting?.strict_section_headers && template) {
      const headerValidation = validateSectionHeaders(response.content, template)
      if (!headerValidation.isValid) {
        console.log('⚠️ Section header validation failed:', headerValidation.errors)
        console.log('🔧 Attempting to fix section headers...')
        response.content = ensureSectionHeaders(response.content, template)
        console.log('✅ Section headers fixed')
      }
    }
    
    return response
  } catch (error) {
    console.error('❌ Error in generateReportEnhanced:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      content: `Error generating report: ${errorMessage}`,
      error: errorMessage
    }
  }
}

// Helper functions for backward compatibility
function createFallbackLogicFromPrompt(generatePrompt: string): any {
  const logic: any = {
    version: "1.0",
    formatting: {
      preserve_template_punctuation: true,
      use_bullet_points: generatePrompt.toLowerCase().includes('bullet'),
      capitalize_sections: true
    },
    report: {
      no_hallucinated_findings: true,
      include_technique_section: generatePrompt.toLowerCase().includes('technique'),
      expand_lesions: generatePrompt.toLowerCase().includes('expand')
    },
    impression: {
      numerically_itemized: generatePrompt.toLowerCase().includes('number'),
      concise_summary: generatePrompt.toLowerCase().includes('concise'),
      include_recommendations: generatePrompt.toLowerCase().includes('recommend')
    }
  }
  
  return logic
}

function getMinimalDefaultLogic(): any {
  return {
    version: "1.0",
    formatting: {
      preserve_template_punctuation: true,
      use_bullet_points: false,
      capitalize_sections: true
    },
    report: {
      no_hallucinated_findings: true,
      include_technique_section: false
    },
    impression: {
      numerically_itemized: true,
      concise_summary: true
    }
  }
}

// Export the original function name for backward compatibility
export { generateReportEnhanced as generateReport }