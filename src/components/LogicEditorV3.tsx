import React, { useState, useEffect } from 'react'
import { 
  fetchAgentLogicV2, 
  updateBaseLogicV2, 
  updateStudyLogicV2, 
  resetLogicV2
} from '../supabase/agentLogicQueriesIPCV2'
// import { LogicEditorTooltips } from './LogicEditorTooltips'
import { 
  StandardizedAgentLogic, 
  StudySpecificLogic,
  getDefaultStandardizedLogic,
  getDefaultStudySpecificLogic 
} from '../utils/standardizedLogicSchema'

interface LogicEditorV3Props {
  userId: string
  studyType: string
  onClose: () => void
  isOfflineMode?: boolean
  userTier?: number
}

type EditMode = 'base' | 'study' | 'preview'

export default function LogicEditorV3({ 
  userId, 
  studyType, 
  onClose, 
  isOfflineMode = false,
  userTier = 1
}: LogicEditorV3Props) {
  const [editMode, setEditMode] = useState<EditMode>('study')
  const [selectedStudyType, setSelectedStudyType] = useState<string>(studyType)
  const [availableStudyTypes, setAvailableStudyTypes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [baseLogic, setBaseLogic] = useState<StandardizedAgentLogic | null>(null)
  const [studyLogic, setStudyLogic] = useState<StudySpecificLogic | null>(null)
  const [mergedLogic, setMergedLogic] = useState<any>(null)
  const [displayLogic, setDisplayLogic] = useState<any>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showPromptPreview, setShowPromptPreview] = useState(false)
  const [showBasePrompt, setShowBasePrompt] = useState(false)
  const [showLegacyLogic, setShowLegacyLogic] = useState(false)
  const [legacyLogic, setLegacyLogic] = useState<any>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [customBasePrompt, setCustomBasePrompt] = useState<string | null>(null)
  const [globalBasePrompt, setGlobalBasePrompt] = useState<string | null>(null)
  const [isEditingBasePrompt, setIsEditingBasePrompt] = useState(false)
  const [isEditingGlobalPrompt, setIsEditingGlobalPrompt] = useState(false)
  
  // Impression base prompt states
  const [globalImpressionPrompt, setGlobalImpressionPrompt] = useState<string | null>(null)
  const [isEditingImpressionPrompt, setIsEditingImpressionPrompt] = useState(false)
  const [showImpressionPrompt, setShowImpressionPrompt] = useState(false)
  
  // Global findings and impression section rules states
  const [globalFindingsRules, setGlobalFindingsRules] = useState<any>(null)
  const [globalImpressionRules, setGlobalImpressionRules] = useState<any>(null)
  const [isEditingGlobalFindingsRules, setIsEditingGlobalFindingsRules] = useState(false)
  const [isEditingGlobalImpressionRules, setIsEditingGlobalImpressionRules] = useState(false)
  const [showGlobalSections, setShowGlobalSections] = useState(false)
  
  // Prompt preview states for tier 5
  const [showStudyPromptPreview, setShowStudyPromptPreview] = useState(false)
  const [showBaseLogicPromptPreview, setShowBaseLogicPromptPreview] = useState(false)
  const [studyPromptPreviewText, setStudyPromptPreviewText] = useState('')
  const [baseLogicPromptPreviewText, setBaseLogicPromptPreviewText] = useState('')
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})  
  function toggleSection(section: string) {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  
  // State for input modal
  const [inputModal, setInputModal] = useState<{ 
    show: boolean, 
    path: string[], 
    label: string,
    value: string 
  }>({ show: false, path: [], label: '', value: '' })

  // Function declarations moved before useEffects to avoid initialization errors
  
  // Helper functions that are used by multiple other functions must be declared first
  function showToast(type: 'success' | 'error', text: string) {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3000)
  }

  async function loadAvailableStudyTypes() {
    try {
      // Fetch available study types from templates
      if (window.electronAPI?.invoke) {
        const templates = await window.electronAPI.invoke('fetch-templates', userId)
        if (templates && !templates.error) {
          const studyTypes = Object.keys(templates).filter(key => key && key.trim()).sort()
          setAvailableStudyTypes(studyTypes)
          console.log('📚 Loaded study types:', studyTypes)
          
          // If no study type is selected but we have templates, select the first one
          if (!selectedStudyType && studyTypes.length > 0) {
            setSelectedStudyType(studyTypes[0])
          }
        } else {
          console.warn('No templates found or error fetching templates:', templates)
        }
      }
    } catch (error) {
      console.error('Error loading study types:', error)
    }
  }

  async function loadLogic() {
    setIsLoading(true)
    console.log('Loading logic for user:', userId, 'study:', selectedStudyType)
    try {
      const result = await fetchAgentLogicV2(userId, selectedStudyType, isOfflineMode)
      if (result.success) {
        console.log('Logic fetch result:', {
          hasBaseLogic: !!result.baseLogic,
          hasStudyLogic: !!result.studyLogic,
          hasLegacyLogic: !!result.legacyLogic,
          legacyLogic: result.legacyLogic
        })
        
        // Only use defaults if baseLogic is actually null/undefined
        const baseLogicToUse = result.baseLogic !== null && result.baseLogic !== undefined 
          ? result.baseLogic 
          : getDefaultStandardizedLogic()
        
        console.log('📊 Base logic to use:', {
          hasResultBaseLogic: result.baseLogic !== null && result.baseLogic !== undefined,
          baseLogicKeys: baseLogicToUse ? Object.keys(baseLogicToUse) : []
        })
        
        setBaseLogic(baseLogicToUse)
        
        // For study logic, deep merge with defaults to ensure all properties exist
        const defaultStudyLogic = getDefaultStudySpecificLogic()
        const loadedStudyLogic = result.studyLogic !== null && result.studyLogic !== undefined 
          ? result.studyLogic 
          : {}
        
        // Deep merge function to properly handle nested objects and arrays
        const deepMergeStudyLogic = (defaults: any, loaded: any): any => {
          const merged = { ...defaults }
          
          for (const key in loaded) {
            if (loaded[key] === null || loaded[key] === undefined) {
              continue
            }
            
            if (Array.isArray(loaded[key])) {
              merged[key] = [...loaded[key]]
            } else if (typeof loaded[key] === 'object' && !Array.isArray(loaded[key])) {
              merged[key] = deepMergeStudyLogic(defaults[key] || {}, loaded[key])
            } else {
              merged[key] = loaded[key]
            }
          }
          
          return merged
        }
        
        const mergedStudyLogic = deepMergeStudyLogic(defaultStudyLogic, loadedStudyLogic)
        setStudyLogic(mergedStudyLogic)
        
        // Store legacy logic if available (check for non-empty object)
        if (result.legacyLogic && Object.keys(result.legacyLogic).length > 0) {
          console.log('Setting legacy logic:', result.legacyLogic)
          setLegacyLogic(result.legacyLogic)
        } else {
          console.log('No legacy logic in result or empty object')
          setLegacyLogic(null)
        }
        
        // Merged logic combines base + study (don't add defaults if we have actual data)
        const merged = {
          ...(baseLogicToUse || {}),
          ...mergedStudyLogic
        }
        
        console.log('📊 Merged logic:', {
          mergedKeys: Object.keys(merged),
          hasGeneral: !!merged.general,
          hasReport: !!merged.report,
          hasImpression: !!merged.impression
        })
        
        setMergedLogic(merged)
      }
    } catch (error) {
      console.error('Error loading logic:', error)
      showToast('error', 'Failed to load logic')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!displayLogic) return
    
    setIsLoading(true)
    try {
      let result
      if (editMode === 'base') {
        // Update the base logic state immediately
        setBaseLogic(displayLogic)
        result = await updateBaseLogicV2(userId, displayLogic, isOfflineMode)
      } else if (editMode === 'study') {
        // Update the study logic state immediately
        setStudyLogic(displayLogic)
        result = await updateStudyLogicV2(userId, selectedStudyType, displayLogic, isOfflineMode)
      }
      
      
      if (result?.success) {
        showToast('success', 'Logic saved successfully')
        // Reload logic to confirm it was saved
        await loadLogic()
      } else {
        throw new Error(result?.error || 'Save failed')
      }
    } catch (error) {
      console.error('❌ Error saving logic:', error)
      showToast('error', `Failed to save logic: ${error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReset() {
    if (!showResetConfirm) {
      setShowResetConfirm(true)
      return
    }
    
    setIsLoading(true)
    try {
      const result = await resetLogicV2(userId, selectedStudyType, editMode === 'base' ? 'base' : 'study', isOfflineMode)
      if (result.success) {
        showToast('success', `${editMode === 'base' ? 'Base' : 'Study'} logic reset to defaults`)
        await loadLogic()
      }
    } catch (error) {
      console.error('Error resetting logic:', error)
      showToast('error', 'Failed to reset logic')
    } finally {
      setIsLoading(false)
      setShowResetConfirm(false)
    }
  }

  async function fetchGlobalBasePrompt() {
    try {
      if (window.electronAPI?.invoke) {
        const result = await window.electronAPI.invoke('fetch-global-base-prompt')
        if (result.success && result.basePrompt) {
          setGlobalBasePrompt(result.basePrompt)
          return result.basePrompt
        }
      }
    } catch (error) {
      console.error('Error fetching global base prompt:', error)
    }
    return null
  }

  async function updateGlobalBasePrompt(newPrompt: string) {
    try {
      if (window.electronAPI?.invoke && userId && userTier >= 5) {
        const result = await window.electronAPI.invoke('update-global-base-prompt', userId, newPrompt)
        if (result.success) {
          setGlobalBasePrompt(newPrompt)
          showToast('success', 'Global base prompt updated for all users')
          return true
        } else {
          showToast('error', result.error || 'Failed to update global base prompt')
        }
      }
    } catch (error) {
      console.error('Error updating global base prompt:', error)
      showToast('error', 'Failed to update global base prompt')
    }
    return false
  }
  
  async function fetchGlobalImpressionPrompt() {
    try {
      if (window.electronAPI?.fetchGlobalImpressionPrompt) {
        const result = await window.electronAPI.fetchGlobalImpressionPrompt()
        if (result.success && result.impressionPrompt) {
          setGlobalImpressionPrompt(result.impressionPrompt)
          return result.impressionPrompt
        }
      }
    } catch (error) {
      console.error('Error fetching global impression prompt:', error)
    }
    return null
  }
  
  async function updateGlobalImpressionPrompt(newPrompt: string) {
    try {
      if (window.electronAPI?.updateGlobalImpressionPrompt && userId && userTier >= 5) {
        const result = await window.electronAPI.updateGlobalImpressionPrompt(userId, newPrompt)
        if (result.success) {
          setGlobalImpressionPrompt(newPrompt)
          showToast('success', 'Global impression prompt updated for all users')
          return true
        } else {
          showToast('error', result.error || 'Failed to update global impression prompt')
        }
      }
    } catch (error) {
      console.error('Error updating global impression prompt:', error)
      showToast('error', 'Failed to update global impression prompt')
    }
    return false
  }
  
  async function fetchGlobalPromptSections() {
    try {
      if (window.electronAPI?.fetchGlobalPromptSections) {
        const result = await window.electronAPI.fetchGlobalPromptSections()
        if (result.success) {
          if (result.globalFindingsRules) {
            // If it's already in text format, use it directly
            if (typeof result.globalFindingsRules === 'string' || result.globalFindingsRules?.text) {
              setGlobalFindingsRules(result.globalFindingsRules)
            } else {
              // Convert JSON to text format for display
              setGlobalFindingsRules({ text: convertRulesToText(result.globalFindingsRules) })
            }
          }
          if (result.globalImpressionRules) {
            // If it's already in text format, use it directly
            if (typeof result.globalImpressionRules === 'string' || result.globalImpressionRules?.text) {
              setGlobalImpressionRules(result.globalImpressionRules)
            } else {
              // Convert JSON to text format for display
              setGlobalImpressionRules({ text: convertImpressionRulesToText(result.globalImpressionRules) })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching global prompt sections:', error)
    }
  }
  
  // Helper to convert JSON rules to text format
  function convertRulesToText(rules: any): string {
    if (!rules) return ''
    const lines: string[] = []
    
    if (rules.custom_rules && Array.isArray(rules.custom_rules)) {
      rules.custom_rules.forEach(rule => lines.push(`• ${rule}`))
    }
    
    if (rules.corrections?.rules && Array.isArray(rules.corrections.rules)) {
      if (lines.length > 0) lines.push('')
      lines.push('Corrections:')
      rules.corrections.rules.forEach(rule => {
        lines.push(`• Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`)
      })
    }
    
    return lines.join('\n')
  }
  
  // Helper to convert JSON impression rules to text format
  function convertImpressionRulesToText(rules: any): string {
    if (!rules) return ''
    const lines: string[] = []
    
    if (rules.custom_rules && Array.isArray(rules.custom_rules)) {
      lines.push('General Rules:')
      rules.custom_rules.forEach(rule => lines.push(`• ${rule}`))
    }
    
    if (rules.exclude_by_default && Array.isArray(rules.exclude_by_default)) {
      if (lines.length > 0) lines.push('')
      lines.push('Exclusions:')
      rules.exclude_by_default.forEach(exclusion => {
        if (typeof exclusion === 'string') {
          lines.push(`• ${exclusion}`)
        } else if (exclusion.finding) {
          lines.push(`• ${exclusion.finding}${exclusion.unless ? ` (unless ${exclusion.unless})` : ''}`)
        }
      })
    }
    
    if (rules.priority?.high_priority_keywords && Array.isArray(rules.priority.high_priority_keywords)) {
      if (lines.length > 0) lines.push('')
      lines.push('Priority Keywords:')
      rules.priority.high_priority_keywords.forEach(keyword => lines.push(`• ${keyword}`))
    }
    
    return lines.join('\n')
  }

  async function updateGlobalFindingsRules(rules: any) {
    // Restrict to tier 5+ users (Developer and above)
    if (userTier < 5) {
      console.warn('Global findings rules editing is restricted to tier 5+ (Developer) users');
      showToast('error', 'Global editing is restricted to tier 5+ (Developer) users');
      return false;
    }
    
    try {
      if (window.electronAPI?.updateGlobalFindingsRules) {
        const result = await window.electronAPI.updateGlobalFindingsRules(userId, rules)
        if (result.success) {
          showToast('success', 'Global findings rules updated successfully')
          return true
        }
      }
    } catch (error) {
      console.error('Error updating global findings rules:', error)
      showToast('error', 'Failed to update global findings rules')
    }
    return false
  }

  async function updateGlobalImpressionRules(rules: any) {
    // Restrict to tier 5+ users (Developer and above)
    if (userTier < 5) {
      console.warn('Global impression rules editing is restricted to tier 5+ (Developer) users');
      showToast('error', 'Global editing is restricted to tier 5+ (Developer) users');
      return false;
    }
    
    try {
      if (window.electronAPI?.updateGlobalImpressionRules) {
        console.log('📤 Sending impression rules to backend:', rules);
        const result = await window.electronAPI.updateGlobalImpressionRules(userId, rules)
        console.log('📥 Backend response:', result);
        if (result && result.success) {
          showToast('success', 'Global impression rules updated successfully')
          return true
        } else {
          console.error('Backend returned error:', result?.error || 'Unknown error');
          showToast('error', result?.error || 'Failed to update global impression rules')
          return false
        }
      } else {
        console.error('updateGlobalImpressionRules not available on electronAPI');
        showToast('error', 'API method not available')
        return false
      }
    } catch (error) {
      console.error('Error updating global impression rules:', error)
      showToast('error', 'Failed to update global impression rules')
    }
    return false
  }

  function getDefaultImpressionPrompt() {
    // Use global impression prompt from database if available, otherwise use hardcoded default
    if (globalImpressionPrompt) {
      return globalImpressionPrompt
    }
    return 'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.'
  }

  function getDefaultBasePrompt() {
    // Use global base prompt from database if available, otherwise use hardcoded default
    if (globalBasePrompt) {
      return globalBasePrompt
    }
    
    // Hardcoded fallback
    let prompt = 'You are an expert radiologist generating a comprehensive radiology report.\n\n'
    
    // Template placeholder
    prompt += 'TEMPLATE STRUCTURE - You MUST follow this exact structure:\n\n'
    prompt += '[TEMPLATE WILL BE INSERTED HERE]\n\n'
    prompt += 'IMPORTANT: Preserve ALL section headers EXACTLY as shown above.\n\n'
    
    // Findings placeholder
    prompt += 'IMPORTANT: The following imaging findings MUST be incorporated:\n\n'
    prompt += '=== FINDINGS TO INCORPORATE ===\n'
    prompt += '[YOUR DICTATED FINDINGS WILL BE INSERTED HERE]\n'
    prompt += '=== END OF FINDINGS ===\n\n'
    
    prompt += '=== CRITICAL RULES ===\n'
    prompt += '• You must incorporate ALL findings provided above into the appropriate sections\n'
    prompt += '• The ONLY allowed sections are "Findings" and "Impression"\n'
    prompt += '• Do not add any other sections (no Technique, no Comparison, no Clinical Information, etc.)\n'
    
    return prompt
  }
  
  function generateBasePrompt() {
    // Priority: 1. User's custom prompt, 2. Global prompt from DB, 3. Hardcoded default
    return customBasePrompt || globalBasePrompt || getDefaultBasePrompt()
  }

  function generatePromptPreview() {
    const logic = mergedLogic || displayLogic || getDefaultStandardizedLogic()
    
    // Start with the base prompt (which already includes template and findings placeholders)
    let prompt = generateBasePrompt() + '\n\n'
    
    let instructionSections: string[] = []
    
    // === GENERAL RULES ===
    const generalRules: string[] = []
    if (logic.general) {
      // Corrections (no toggle, always active if rules exist)
      if (logic.general.corrections?.rules?.length > 0) {
        for (const rule of logic.general.corrections.rules) {
          if (rule.find && rule.replace) {
            generalRules.push(`• Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`)
          }
        }
      }
      
      
      // Disallowed Symbols
      if (logic.general.disallowed_symbols?.enabled !== false && logic.general.disallowed_symbols?.symbols?.length > 0) {
        generalRules.push(`• NEVER use these formatting symbols: ${logic.general.disallowed_symbols.symbols.join(', ')}`)
      }
      
    }
    
    if (generalRules.length > 0) {
      instructionSections.push('=== GENERAL RULES ===')
      instructionSections.push(...generalRules)
      instructionSections.push('')
    }
    
    // === FINDINGS SECTION RULES === (Combined base + study-specific)
    const findingsRules: string[] = []
    
    // Base findings rules
    if (logic.report) {
      if (logic.report.formatting) {
        if (logic.report.formatting.use_bullet_points) {
          findingsRules.push('• Use bullet points for listing findings within sections')
        }
      }
      
      if (logic.report.language?.expand_lesion_descriptions) {
        findingsRules.push('• Expand lesion descriptions with typical imaging features (signal, margins, enhancement, mass effect) only if this clarifies the description without adding new findings.')
      }
    }
    
    // Study-specific findings rules (merged into same section)
    if (logic.study_report) {
      // Word corrections
      if (logic.study_report.corrections?.rules?.length > 0) {
        for (const rule of logic.study_report.corrections.rules) {
          if (rule.find && rule.replace) {
            findingsRules.push(`• Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`)
          }
        }
      }
      
      if (logic.study_report.anatomic_routing_rules && logic.study_report.anatomic_routing_rules.length > 0) {
        for (const rule of logic.study_report.anatomic_routing_rules) {
          if (rule.condition && rule.route_to) {
            findingsRules.push(`• If finding contains "${rule.condition}", route to "${rule.route_to}" section`)
          }
        }
      }
      
      if (logic.study_report.custom_rules && logic.study_report.custom_rules.length > 0) {
        findingsRules.push(...logic.study_report.custom_rules.map(r => `• ${r}`))
      }
    }
    
    if (findingsRules.length > 0) {
      instructionSections.push('=== FINDINGS SECTION RULES ===')
      instructionSections.push(...findingsRules)
      instructionSections.push('')
    }
    
    // === IMPRESSION SECTION RULES === (Combined base + study-specific)
    const impressionRules: string[] = []
    
    // FIRST: Add required opening phrase if present (study-specific)
    if (logic.study_impression?.required_opening_phrase?.enabled && logic.study_impression.required_opening_phrase.phrase) {
      const numbered = logic.study_impression.required_opening_phrase.numbered !== false  // Default to true
      if (numbered) {
        impressionRules.push(`• REQUIRED: Start the impression with: "${logic.study_impression.required_opening_phrase.phrase}"`)
      } else {
        impressionRules.push(`• REQUIRED: Start the impression with: "${logic.study_impression.required_opening_phrase.phrase}" but DO NOT number this opening phrase`)
      }
    }
    
    // Base impression rules
    if (logic.impression) {
      if (logic.impression.format) {
        switch (logic.impression.format.style) {
          case 'numerically_itemized':
            impressionRules.push('• Use numbered list (1, 2, 3, etc.)')
            break
          case 'bullet_points':
            impressionRules.push('• Use bullet points (• ) for each item')
            break
          case 'none':
            impressionRules.push('• Write as continuous prose without bullets or numbers')
            break
        }
        
        if (logic.impression.format.spacing === 'double') {
          impressionRules.push('• Use double spacing between impression items')
        } else {
          impressionRules.push('• Use single spacing between impression items')
        }
      }
      
      // Base exclusions
      if (logic.impression.exclude_by_default && logic.impression.exclude_by_default.length > 0) {
        const baseExclusions = logic.impression.exclude_by_default.map(item => {
          if (typeof item === 'string') {
            return item.replace(/_/g, ' ').toLowerCase()
          } else if (item && typeof item === 'object') {
            // Handle conditional exclusion
            let exclusion = item.finding
            if (item.unless) {
              exclusion += ` UNLESS ${item.unless}`
            }
            return exclusion
          }
          return ''
        }).filter(e => e)
        
        if (baseExclusions.length > 0) {
          impressionRules.push('')
          impressionRules.push('Do not mention these findings in the impression:')
          baseExclusions.forEach(exclusion => {
            impressionRules.push(`  • ${exclusion}`)
          })
          impressionRules.push('')
        }
      }
    }
    
    // Study-specific impression rules (merged into same section)
    if (logic.study_impression) {
      // Grouping strategy
      if (logic.study_impression.grouping_strategy) {
        switch (logic.study_impression.grouping_strategy) {
          case 'severity':
            impressionRules.push('• Group impression items by severity (most to least severe)')
            break
          case 'anatomic_region':
            impressionRules.push('• Group impression items by anatomic region (e.g., lateral → medial → central)')
            break
          case 'clinical_relevance':
            impressionRules.push('• Group impression items by clinical relevance based on keywords')
            break
        }
      }
      
      // Auto-reordering
      if (logic.study_impression.auto_reordering === false) {
        impressionRules.push('• IMPORTANT: Preserve the order of user-entered findings - do NOT reorder')
      } else {
        impressionRules.push('• Intelligently reorder findings based on severity and clinical importance')
      }
      
      // Study-specific exclusions
      if (logic.study_impression.exclude_by_default && logic.study_impression.exclude_by_default.length > 0) {
        const studyExclusions = logic.study_impression.exclude_by_default.map(item => {
          if (typeof item === 'string') {
            return item.replace(/_/g, ' ').toLowerCase()
          } else if (item && typeof item === 'object') {
            // Handle conditional exclusion
            let exclusion = item.finding
            if (item.unless) {
              exclusion += ` UNLESS ${item.unless}`
            }
            return exclusion
          }
          return ''
        }).filter(e => e)
        
        if (studyExclusions.length > 0) {
          // Check if we already have exclusions section
          const hasExistingExclusions = impressionRules.includes('Do not mention these findings in the impression:')
          if (!hasExistingExclusions) {
            impressionRules.push('')
            impressionRules.push('Do not mention these findings in the impression:')
          }
          studyExclusions.forEach(exclusion => {
            impressionRules.push(`  • ${exclusion}`)
          })
          if (!hasExistingExclusions) {
            impressionRules.push('')
          }
        }
      }
      
      // Custom impression rules
      if (logic.study_impression.custom_rules && logic.study_impression.custom_rules.length > 0) {
        impressionRules.push(...logic.study_impression.custom_rules.map(r => `• ${r}`))
      }
    }
    
    if (impressionRules.length > 0) {
      instructionSections.push('=== IMPRESSION SECTION RULES ===')
      instructionSections.push(...impressionRules)
      instructionSections.push('')
    }
    
    // === PRIORITY ORDERING ===
    if (logic.study_impression?.priority) {
      const priority = logic.study_impression.priority
      const hasPriorities = (priority.high_priority_findings?.length || 0) + 
                           (priority.high_priority_keywords?.length || 0) +
                           (priority.mid_priority_findings?.length || 0) + 
                           (priority.mid_priority_keywords?.length || 0) +
                           (priority.low_priority_findings?.length || 0) + 
                           (priority.low_priority_keywords?.length || 0) > 0
      
      if (hasPriorities) {
        const priorityRules: string[] = []
        
        if (priority.high_priority_findings?.length || priority.high_priority_keywords?.length) {
          priorityRules.push('HIGH PRIORITY (list first):')
          if (priority.high_priority_findings?.length) {
            priorityRules.push(`  • Findings: ${priority.high_priority_findings.join(', ')}`)
          }
          if (priority.high_priority_keywords?.length) {
            priorityRules.push(`  • Keywords: ${priority.high_priority_keywords.join(', ')}`)
          }
        }
        
        if (priority.mid_priority_findings?.length || priority.mid_priority_keywords?.length) {
          priorityRules.push('MID PRIORITY (list after high priority):')
          if (priority.mid_priority_findings?.length) {
            priorityRules.push(`  • Findings: ${priority.mid_priority_findings.join(', ')}`)
          }
          if (priority.mid_priority_keywords?.length) {
            priorityRules.push(`  • Keywords: ${priority.mid_priority_keywords.join(', ')}`)
          }
        }
        
        if (priority.low_priority_findings?.length || priority.low_priority_keywords?.length) {
          priorityRules.push('LOW PRIORITY (list last):')
          if (priority.low_priority_findings?.length) {
            priorityRules.push(`  • Findings: ${priority.low_priority_findings.join(', ')}`)
          }
          if (priority.low_priority_keywords?.length) {
            priorityRules.push(`  • Keywords: ${priority.low_priority_keywords.join(', ')}`)
          }
        }
        
        if (priorityRules.length > 0) {
          instructionSections.push('=== PRIORITY ORDERING ===')
          instructionSections.push(...priorityRules)
          instructionSections.push('')
        }
      }
    }
    
    // === CUSTOM INSTRUCTIONS ===
    if (logic.custom_instructions && logic.custom_instructions.length > 0) {
      instructionSections.push('=== CUSTOM INSTRUCTIONS ===')
      instructionSections.push(...logic.custom_instructions.map(inst => `• ${inst}`))
      instructionSections.push('')
    }
    
    // Build final prompt
    if (instructionSections.length > 0) {
      prompt += instructionSections.join('\n')
    }
    
    return prompt
  }

  function generateStudyPromptPreview() {
    const logic = mergedLogic || displayLogic || getDefaultStandardizedLogic()
    let previewText = '=== STUDY-SPECIFIC LOGIC OUTPUT ===\n\n'
    
    // Study-specific report rules
    if (logic.study_report) {
      previewText += '--- STUDY REPORT SECTION ---\n\n'
      
      // Corrections
      if (logic.study_report.corrections?.rules?.length > 0) {
        previewText += 'Text Replacements:\n'
        for (const rule of logic.study_report.corrections.rules) {
          if (rule.find && rule.replace) {
            previewText += `• Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}\n`
          }
        }
        previewText += '\n'
      }
      
      // Anatomic routing rules
      if (logic.study_report.anatomic_routing_rules?.length > 0) {
        previewText += 'Anatomic Routing Rules:\n'
        for (const rule of logic.study_report.anatomic_routing_rules) {
          if (rule.condition && rule.route_to) {
            previewText += `• If finding contains "${rule.condition}", route to "${rule.route_to}"\n`
          }
        }
        previewText += '\n'
      }
      
      // Custom findings rules
      if (logic.study_report.custom_findings_rules?.length > 0) {
        previewText += 'Custom Findings Rules:\n'
        for (const rule of logic.study_report.custom_findings_rules) {
          previewText += `• ${rule}\n`
        }
        previewText += '\n'
      }
    }
    
    // Study-specific impression rules
    if (logic.study_impression) {
      previewText += '--- STUDY IMPRESSION SECTION ---\n\n'
      
      if (logic.study_impression.custom_rules?.length > 0) {
        previewText += 'Custom Impression Rules:\n'
        for (const rule of logic.study_impression.custom_rules) {
          previewText += `• ${rule}\n`
        }
        previewText += '\n'
      }
      
      if (logic.study_impression.include_dose_reduction_statement) {
        previewText += '• Include dose reduction statement when appropriate\n\n'
      }
    }
    
    return previewText
  }

  function generateBaseLogicPromptPreview() {
    const logic = mergedLogic || displayLogic || getDefaultStandardizedLogic()
    let previewText = '=== BASE LOGIC OUTPUT ===\n\n'
    
    // General rules
    if (logic.general) {
      previewText += '--- GENERAL RULES ---\n\n'
      
      // Corrections
      if (logic.general.corrections?.rules?.length > 0) {
        previewText += 'Text Replacements:\n'
        for (const rule of logic.general.corrections.rules) {
          if (rule.find && rule.replace) {
            previewText += `• Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}\n`
          }
        }
        previewText += '\n'
      }
      
      
    }
    
    // Base report rules
    if (logic.report) {
      previewText += '--- BASE REPORT RULES ---\n\n'
      
      if (logic.report.formatting) {
        previewText += 'Formatting:\n'
        if (logic.report.formatting.use_bullet_points) {
          previewText += '• Use bullet points for listing findings within sections\n'
        }
        previewText += '\n'
      }
      
      if (logic.report.language?.expand_lesion_descriptions) {
        previewText += '• Expand lesion descriptions with typical imaging features\n\n'
      }
    }
    
    // Base impression rules
    if (logic.impression) {
      previewText += '--- BASE IMPRESSION RULES ---\n\n'
      
      if (logic.impression.format) {
        previewText += 'Format:\n'
        switch (logic.impression.format) {
          case 'numbered_list':
            previewText += '• Format as a short numbered list, but closely related findings should be combined into one item\n'
            break
          case 'narrative':
            previewText += '• Format as narrative text in paragraph form\n'
            break
        }
        previewText += '\n'
      }
      
      if (logic.impression.options) {
        previewText += 'Options:\n'
        if (logic.impression.options.include_patient_specific_recommendations) {
          previewText += '• Include patient-specific follow-up recommendations\n'
        }
        if (logic.impression.options.is_addendum) {
          previewText += '• This is an addendum to a previous report\n'
        }
        previewText += '\n'
      }
    }
    
    return previewText
  }

  function updateLogicValue(path: string[], value: any) {
    if (!displayLogic) return
    
    const newLogic = JSON.parse(JSON.stringify(displayLogic))
    let current = newLogic
    
    // Ensure all intermediate objects exist
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        // Check if the next level should be an array or object
        // For now, default to object
        current[path[i]] = {}
      }
      current = current[path[i]]
    }
    
    // Special handling for arrays - ensure it's an array if we're setting an array value
    const lastKey = path[path.length - 1]
    if (Array.isArray(value) && !current[lastKey]) {
      current[lastKey] = []
    }
    
    current[lastKey] = value
    setDisplayLogic(newLogic)
  }

  const renderToggle = (path: string[], value: boolean, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => updateLogicValue(path, e.target.checked)}
          disabled={editMode === 'preview'}
        />
        <span style={{ color: '#ccc' }}>{label}</span>
      </label>
    </div>
  )

  const renderTextInput = (path: string[], value: string, label: string) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => updateLogicValue(path, e.target.value)}
        disabled={editMode === 'preview'}
        style={{
          width: '100%',
          padding: '6px 10px',
          backgroundColor: '#2a2a2a',
          border: '1px solid #3a3a3a',
          borderRadius: 4,
          color: '#fff',
          fontSize: 13
        }}
      />
    </div>
  )

  function renderArrayInput(path: string[], defaultItems: string[], label: string) {
    // Get the actual value from displayLogic
    let current: any = displayLogic
    for (let i = 0; i < path.length - 1; i++) {
      current = current?.[path[i]]
    }
    const actualItems = current?.[path[path.length - 1]] ?? defaultItems
    
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>
          {label}
        </label>
        
        {/* List of existing items */}
        {actualItems.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {actualItems.map((item: string, index: number) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 6,
                padding: '6px 10px',
                backgroundColor: '#2a2a2a',
                borderRadius: 4,
                border: '1px solid #3a3a3a'
              }}>
                {editMode === 'preview' ? (
                  <span style={{ flex: 1, color: '#fff', fontSize: 13 }}>{item}</span>
                ) : (
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...actualItems]
                      newItems[index] = e.target.value
                      updateLogicValue(path, newItems)
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 13
                    }}
                  />
                )}
                {editMode !== 'preview' && (
                  <button
                    onClick={() => {
                      const newItems = actualItems.filter((_, i) => i !== index)
                      updateLogicValue(path, newItems)
                    }}
                    style={{
                      marginLeft: 8,
                      padding: '2px 8px',
                      backgroundColor: '#dc2626',
                      border: 'none',
                      borderRadius: 3,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Add new item button - uses custom modal */}
        {editMode !== 'preview' && (
          <button
            onClick={() => {
              setInputModal({ 
                show: true, 
                path: path, 
                label: label,
                value: '' 
              })
            }}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
            }}
          >
            + Add Item
          </button>
        )}
      </div>
    )
  }

  const renderSectionHeader = (title: string, sectionKey: string, icon?: string) => (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '12px 18px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: 12,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s',
        backdropFilter: 'blur(10px)'
      }}
      onClick={() => toggleSection(sectionKey)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }}
    >
      <span style={{ 
        marginRight: 10, 
        transform: collapsedSections[sectionKey] ? 'rotate(-90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
        color: '#888',
        fontSize: 12
      }}>▼</span>
      {icon && <span style={{ marginRight: 10, fontSize: 18 }}>{icon}</span>}
      <h4 style={{ color: '#fff', margin: 0, fontSize: 14, fontWeight: 500, opacity: 0.9 }}>{title}</h4>
    </div>
  )

  function renderV3Logic() {
    if (!displayLogic) return null

    return (
      <div style={{ padding: '15px 20px' }}>
        {/* GENERAL SETTINGS */}
        <div style={{ marginBottom: 25 }}>
          <h3 style={{ 
            color: '#3ABC96', 
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 15,
            paddingBottom: 10,
            borderBottom: '2px solid #3a3a3a'
          }}>📋 GENERAL SETTINGS</h3>
          
          {/* Corrections Section */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Text Corrections & Replacements', 'corrections', '✏️')}
            {!collapsedSections['corrections'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ marginBottom: 10, color: '#888', fontSize: 12 }}>
                  Define text replacements that will be applied to the generated report
                </div>
            <div style={{ marginTop: 10 }}>
              {(displayLogic.general?.corrections?.rules || []).map((rule, index) => (
                <div key={index} style={{ 
                  marginBottom: 10, 
                  padding: 10, 
                  backgroundColor: '#2a2a2a', 
                  borderRadius: 4,
                  border: '1px solid #3a3a3a'
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    <input
                      type="text"
                      placeholder="Find text..."
                      value={rule.find}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.general?.corrections?.rules || [])]
                        newRules[index] = { ...newRules[index], find: e.target.value }
                        updateLogicValue(['general', 'corrections', 'rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    <span style={{ color: '#888' }}>→</span>
                    <input
                      type="text"
                      placeholder="Replace with..."
                      value={rule.replace}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.general?.corrections?.rules || [])]
                        newRules[index] = { ...newRules[index], replace: e.target.value }
                        updateLogicValue(['general', 'corrections', 'rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    {editMode !== 'preview' && (
                      <button
                        onClick={() => {
                          const newRules = (displayLogic.general?.corrections?.rules || []).filter((_, i) => i !== index)
                          updateLogicValue(['general', 'corrections', 'rules'], newRules)
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc2626',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {rule.description && (
                    <small style={{ color: '#888', fontSize: 11 }}>{rule.description}</small>
                  )}
                </div>
              ))}
              {editMode !== 'preview' && (
                <button
                  onClick={() => {
                    const newRules = [...(displayLogic.general?.corrections?.rules || []), { find: '', replace: '', description: '' }]
                    updateLogicValue(['general', 'corrections', 'rules'], newRules)
                  }}
                  style={{
                    marginTop: 10,
                    padding: '6px 12px',
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  + Add Correction Rule
                </button>
              )}
            </div>
              </div>
            )}
          </div>


          {/* Document Structure */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Document Structure', 'structure', '📄')}
            {!collapsedSections['structure'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ marginBottom: 15 }}>
                  <h5 style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Allowed Sections</h5>
                  {renderToggle(['general', 'allowed_sections', 'enabled'], 
                    displayLogic.general?.allowed_sections?.enabled !== false, 
                    'Limit report to specific sections only')}
                  {displayLogic.general?.allowed_sections?.enabled !== false && (
                    <div style={{ marginLeft: 20, marginTop: 10 }}>
                      {renderArrayInput(['general', 'allowed_sections', 'sections'], 
                        ['FINDINGS', 'IMPRESSION'], 
                        'Allowed section names (e.g., FINDINGS, IMPRESSION)')}
                    </div>
                  )}
                </div>
                
                <div style={{ marginBottom: 15 }}>
                  <h5 style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Disallowed Symbols</h5>
                  {renderToggle(['general', 'disallowed_symbols', 'enabled'], 
                    displayLogic.general?.disallowed_symbols?.enabled !== false, 
                    'Prevent formatting symbols like * and #')}
                  {displayLogic.general?.disallowed_symbols?.enabled !== false && (
                    <div style={{ marginLeft: 20, marginTop: 10 }}>
                      {renderArrayInput(['general', 'disallowed_symbols', 'symbols'], 
                        ['*', '**', '###', '##'], 
                        'Symbols to prevent (e.g., *, **, ###)')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
        </div>

        {/* REPORT SETTINGS CARD */}
        <div style={{ 
          marginBottom: 30,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(102, 126, 234, 0.2)',
          padding: 20,
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 20,
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 24, filter: 'none', WebkitTextFillColor: 'initial' }}>📝</span>
            REPORT SETTINGS
          </h3>
          
          {/* Formatting */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Report Formatting', 'formatting', '📐')}
            {!collapsedSections['formatting'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.3)', 
                  padding: 15, 
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(5px)'
                }}>
                  {renderToggle(['report', 'formatting', 'use_bullet_points'], 
                    displayLogic.report?.formatting?.use_bullet_points || false, 
                    'Use bullet points in findings')}
                </div>
              </div>
            )}
          </div>

          {/* Language */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Language & Style', 'language', '✍️')}
            {!collapsedSections['language'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                {renderToggle(['report', 'language', 'expand_lesion_descriptions'], 
                  displayLogic.report?.language?.expand_lesion_descriptions || false, 
                  'Expand lesion descriptions with more detail')}
              </div>
            )}
          </div>
        </div>

        {/* BASE IMPRESSION SETTINGS CARD - Green gradient */}
        <div style={{ 
          marginBottom: 30,
          background: 'linear-gradient(135deg, rgba(58, 188, 150, 0.15) 0%, rgba(42, 155, 122, 0.15) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(58, 188, 150, 0.3)',
          padding: 20,
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ 
            background: 'linear-gradient(135deg, #3ABC96 0%, #2a9b7a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 20,
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 24, filter: 'none', WebkitTextFillColor: 'initial' }}>💡</span>
            BASE IMPRESSION SETTINGS
          </h3>
          
          {/* Format */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Impression Format', 'impression_format', '📋')}
            {!collapsedSections['impression_format'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    List Style
                  </label>
                  <select
                    value={displayLogic.impression?.format?.style || 'numerically_itemized'}
                    onChange={(e) => updateLogicValue(['impression', 'format', 'style'], e.target.value)}
                    disabled={editMode === 'preview'}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff'
                    }}
                  >
                    <option value="numerically_itemized">Numbered List (1, 2, 3)</option>
                    <option value="bullet_points">Bullet Points (•)</option>
                    <option value="none">Plain Text</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Line Spacing
                  </label>
                  <select
                    value={displayLogic.impression?.format?.spacing || 'double'}
                    onChange={(e) => updateLogicValue(['impression', 'format', 'spacing'], e.target.value)}
                    disabled={editMode === 'preview'}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff'
                    }}
                  >
                    <option value="single">Single Space</option>
                    <option value="double">Double Space</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Exclusions */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Finding Exclusions', 'exclusions', '🚫')}
            {!collapsedSections['exclusions'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  marginBottom: 12, 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 13,
                  padding: '10px 15px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  Specify findings that should not appear in the impression
                </div>
                {renderArrayInput(['impression', 'exclude_by_default'], 
                  [], 
                  'Items to exclude (e.g., "small joint effusion", or "small joint effusion UNLESS there is synovitis")')}
              </div>
            )}
          </div>
        </div>

        {/* CUSTOM INSTRUCTIONS CARD */}
        {displayLogic.custom_instructions && (
          <div style={{ 
            marginBottom: 30,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: 12,
            border: '1px solid rgba(102, 126, 234, 0.2)',
            padding: 20,
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 20,
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <span style={{ fontSize: 24, filter: 'none', WebkitTextFillColor: 'initial' }}>⚙️</span>
              CUSTOM INSTRUCTIONS
            </h3>
            <div style={{ marginBottom: 20 }}>
              {renderSectionHeader('Additional Instructions', 'custom_instructions', '📝')}
              {!collapsedSections['custom_instructions'] && (
                <div style={{ marginLeft: 15, marginTop: 10 }}>
                  <div style={{ 
                    marginBottom: 12, 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: 13,
                    padding: '10px 15px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    Add any additional custom instructions for report generation
                  </div>
                  {renderArrayInput(['custom_instructions'], 
                    [], 
                    'Custom instructions (one per line)')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderStudySpecificLogic() {
    if (!displayLogic) return null

    return (
      <div style={{ padding: '15px 20px' }}>
        {/* STUDY-SPECIFIC REPORT SETTINGS - Purple gradient card like base report */}
        <div style={{ 
          marginBottom: 30,
          background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.15) 0%, rgba(142, 68, 173, 0.15) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(155, 89, 182, 0.3)',
          padding: 20,
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ 
            color: '#b19cd9',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 15,
            paddingBottom: 10,
            borderBottom: '2px solid rgba(155, 89, 182, 0.2)'
          }}>🎯 STUDY-SPECIFIC REPORT</h3>
          
          {/* Study Corrections */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Study-Specific Corrections', 'study_corrections', '✏️')}
            {!collapsedSections['study_corrections'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  marginBottom: 12, 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 13,
                  padding: '10px 15px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  Additional text replacements specific to this study type
                </div>
            <div style={{ marginTop: 10 }}>
              {(displayLogic.study_report?.corrections?.rules || []).map((rule, index) => (
                <div key={index} style={{ 
                  marginBottom: 10, 
                  padding: 10, 
                  backgroundColor: '#2a2a2a', 
                  borderRadius: 4,
                  border: '1px solid #3a3a3a'
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    <input
                      type="text"
                      placeholder="Find text..."
                      value={rule.find}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.study_report?.corrections?.rules || [])]
                        newRules[index] = { ...newRules[index], find: e.target.value }
                        updateLogicValue(['study_report', 'corrections', 'rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Replace with..."
                      value={rule.replace}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.study_report?.corrections?.rules || [])]
                        newRules[index] = { ...newRules[index], replace: e.target.value }
                        updateLogicValue(['study_report', 'corrections', 'rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    {editMode !== 'preview' && (
                      <button
                        onClick={() => {
                          const newRules = (displayLogic.study_report?.corrections?.rules || []).filter((_, i) => i !== index)
                          updateLogicValue(['study_report', 'corrections', 'rules'], newRules)
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc2626',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={rule.description || ''}
                    onChange={(e) => {
                      const newRules = [...(displayLogic.study_report?.corrections?.rules || [])]
                      newRules[index] = { ...newRules[index], description: e.target.value }
                      updateLogicValue(['study_report', 'corrections', 'rules'], newRules)
                    }}
                    disabled={editMode === 'preview'}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #3a3a3a',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 13
                    }}
                  />
                </div>
              ))}
              {editMode !== 'preview' && (
                <button
                  onClick={() => {
                    const newRules = [...(displayLogic.study_report?.corrections?.rules || []), { find: '', replace: '', description: '' }]
                    updateLogicValue(['study_report', 'corrections', 'rules'], newRules)
                  }}
                  style={{
                    marginTop: 10,
                    padding: '6px 12px',
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  + Add Correction Rule
                </button>
              )}
            </div>
              </div>
            )}
          </div>
          
          {/* Anatomic Routing Rules */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Anatomic Routing Rules', 'anatomic_routing', '🗺️')}
            {!collapsedSections['anatomic_routing'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  marginBottom: 12, 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 13,
                  padding: '10px 15px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  Define rules to route findings to specific sections based on keywords
                </div>
            <div style={{ marginTop: 10 }}>
              {(displayLogic.study_report?.anatomic_routing_rules || []).map((rule, index) => (
                <div key={index} style={{ 
                  marginBottom: 10, 
                  padding: 10, 
                  backgroundColor: '#2a2a2a', 
                  borderRadius: 4,
                  border: '1px solid #3a3a3a'
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
                    <input
                      type="text"
                      placeholder="If finding contains..."
                      value={rule.condition}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.study_report?.anatomic_routing_rules || [])]
                        newRules[index] = { ...newRules[index], condition: e.target.value }
                        updateLogicValue(['study_report', 'anatomic_routing_rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    <span style={{ color: '#888' }}>→</span>
                    <input
                      type="text"
                      placeholder="Route to section..."
                      value={rule.route_to}
                      onChange={(e) => {
                        const newRules = [...(displayLogic.study_report?.anatomic_routing_rules || [])]
                        newRules[index] = { ...newRules[index], route_to: e.target.value }
                        updateLogicValue(['study_report', 'anatomic_routing_rules'], newRules)
                      }}
                      disabled={editMode === 'preview'}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                    {editMode !== 'preview' && (
                      <button
                        onClick={() => {
                          const newRules = (displayLogic.study_report?.anatomic_routing_rules || []).filter((_, i) => i !== index)
                          updateLogicValue(['study_report', 'anatomic_routing_rules'], newRules)
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc2626',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {editMode !== 'preview' && (
                <button
                  onClick={() => {
                    const newRules = [...(displayLogic.study_report?.anatomic_routing_rules || []), { condition: '', route_to: '', description: '' }]
                    updateLogicValue(['study_report', 'anatomic_routing_rules'], newRules)
                  }}
                  style={{
                    marginTop: 10,
                    padding: '6px 12px',
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  + Add Routing Rule
                </button>
              )}
            </div>
              </div>
            )}
          </div>

          {/* Custom Rules */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Custom Report Rules', 'custom_report_rules', '📑')}
            {!collapsedSections['custom_report_rules'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                {renderArrayInput(['study_report', 'custom_rules'], 
                  [], 
                  'Custom report rules (one per line)')}
              </div>
            )}
          </div>
        </div>

        {/* STUDY-SPECIFIC IMPRESSION SETTINGS - Green gradient card like base impression */}
        <div style={{ 
          marginBottom: 30,
          background: 'linear-gradient(135deg, rgba(58, 188, 150, 0.15) 0%, rgba(42, 155, 122, 0.15) 100%)',
          borderRadius: 12,
          border: '1px solid rgba(58, 188, 150, 0.3)',
          padding: 20,
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ 
            color: '#3ABC96', 
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 15,
            paddingBottom: 10,
            borderBottom: '2px solid rgba(58, 188, 150, 0.2)'
          }}>🌟 STUDY-SPECIFIC IMPRESSION</h3>
          
          {/* Required Opening Phrase */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Opening Phrase', 'opening_phrase', '💬')}
            {!collapsedSections['opening_phrase'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ marginBottom: 10 }}>
                  {renderToggle(['study_impression', 'required_opening_phrase', 'enabled'], 
                    displayLogic.study_impression?.required_opening_phrase?.enabled || false, 
                    'Require specific opening phrase')}
                </div>
                {displayLogic.study_impression?.required_opening_phrase?.enabled && (
                  <>
                    <input
                      type="text"
                      placeholder="Enter opening phrase..."
                      value={displayLogic.study_impression?.required_opening_phrase?.phrase || ''}
                      onChange={(e) => updateLogicValue(['study_impression', 'required_opening_phrase', 'phrase'], e.target.value)}
                      disabled={editMode === 'preview'}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        color: '#fff',
                        fontSize: 13,
                        marginBottom: 10
                      }}
                    />
                    <div style={{ marginLeft: 10 }}>
                      {renderToggle(['study_impression', 'required_opening_phrase', 'numbered'], 
                        displayLogic.study_impression?.required_opening_phrase?.numbered !== false,  // Default to true
                        'Number this opening phrase')}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Priority Settings */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Priority Settings', 'priority_settings', '🏆')}
            {!collapsedSections['priority_settings'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  marginBottom: 12, 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 13,
                  padding: '10px 15px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  Define which findings should appear first, in the middle, or last in the impression
                </div>
                
                <div style={{ 
                  marginBottom: 20, 
                  padding: 15, 
                  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%)',
                  borderRadius: 8, 
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <h5 style={{ color: '#ef4444', fontSize: 14, marginBottom: 12, fontWeight: 600, letterSpacing: '0.5px' }}>🔴 HIGH PRIORITY (List First)</h5>
              {renderArrayInput(['study_impression', 'priority', 'high_priority_findings'], 
                [], 
                'High priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'high_priority_keywords'], 
                [], 
                'High priority keywords (one per line)')}
                </div>

                <div style={{ 
                  marginBottom: 20, 
                  padding: 15, 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
                  borderRadius: 8, 
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <h5 style={{ color: '#f59e0b', fontSize: 14, marginBottom: 12, fontWeight: 600, letterSpacing: '0.5px' }}>🟡 MID PRIORITY (List in Middle)</h5>
              {renderArrayInput(['study_impression', 'priority', 'mid_priority_findings'], 
                [], 
                'Mid priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'mid_priority_keywords'], 
                [], 
                'Mid priority keywords (one per line)')}
                </div>

                <div style={{ 
                  padding: 15, 
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%)',
                  borderRadius: 8, 
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <h5 style={{ color: '#10b981', fontSize: 14, marginBottom: 12, fontWeight: 600, letterSpacing: '0.5px' }}>🟢 LOW PRIORITY (List Last)</h5>
              {renderArrayInput(['study_impression', 'priority', 'low_priority_findings'], 
                [], 
                'Low priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'low_priority_keywords'], 
                [], 
                'Low priority keywords (one per line)')}
                </div>
              </div>
            )}
          </div>

          {/* Study-Specific Exclusions */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Study-Specific Exclusions', 'study_exclusions', '🚫')}
            {!collapsedSections['study_exclusions'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                <div style={{ 
                  marginBottom: 12, 
                  color: 'rgba(255, 255, 255, 0.6)', 
                  fontSize: 13,
                  padding: '10px 15px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  Additional exclusions specific to this study type
                </div>
                {renderArrayInput(['study_impression', 'exclude_by_default'], 
                  [], 
                  'Study-specific exclusions (e.g., "mild degenerative changes", or "effusion UNLESS moderate or large")')}
              </div>
            )}
          </div>

          {/* Custom Rules */}
          <div style={{ marginBottom: 20 }}>
            {renderSectionHeader('Custom Impression Rules', 'custom_impression_rules', '📑')}
            {!collapsedSections['custom_impression_rules'] && (
              <div style={{ marginLeft: 15, marginTop: 10 }}>
                {renderArrayInput(['study_impression', 'custom_rules'], 
                  [], 
                  'Additional impression rules specific to this study type')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // useEffect hooks - must be after all function declarations
  useEffect(() => {
    loadAvailableStudyTypes()
    // Load custom base prompt from localStorage if it exists
    const savedPrompt = localStorage.getItem('customBasePrompt')
    if (savedPrompt) {
      setCustomBasePrompt(savedPrompt)
    }
    // Fetch global base prompt from database
    fetchGlobalBasePrompt()
    // Fetch global impression prompt from database
    fetchGlobalImpressionPrompt()
    // Fetch global findings and impression section rules
    fetchGlobalPromptSections()
  }, [userId])

  useEffect(() => {
    if (selectedStudyType) {
      loadLogic()
    }
  }, [selectedStudyType, userId])

  useEffect(() => {
    console.log('📝 Setting display logic for mode:', editMode, {
      hasBaseLogic: !!baseLogic,
      hasStudyLogic: !!studyLogic,
      hasMergedLogic: !!mergedLogic
    })
    
    switch (editMode) {
      case 'base':
        // Only use defaults if baseLogic is truly not loaded yet
        if (baseLogic !== null) {
          console.log('📝 Setting base logic as display:', baseLogic)
          setDisplayLogic(baseLogic)
        }
        break
      case 'study':
        // Ensure study logic has all required structure
        const studyLogicWithDefaults = studyLogic !== null ? studyLogic : getDefaultStudySpecificLogic()
        // Make sure all required properties exist
        if (!studyLogicWithDefaults.study_report) {
          studyLogicWithDefaults.study_report = getDefaultStudySpecificLogic().study_report
        }
        if (!studyLogicWithDefaults.study_impression) {
          studyLogicWithDefaults.study_impression = getDefaultStudySpecificLogic().study_impression
        }
        setDisplayLogic(studyLogicWithDefaults)
        break
      case 'preview':
        // Only set display logic if we have merged logic
        if (mergedLogic !== null) {
          setDisplayLogic(mergedLogic)
        }
        break
    }
  }, [editMode, baseLogic, studyLogic, mergedLogic])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      {/* Logic Editor Tooltips */}
      {/* <LogicEditorTooltips /> */}
      
      <div style={{
        backgroundColor: '#0f0f0f',
        borderRadius: 12,
        width: '90%',
        maxWidth: 1000,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        border: '1px solid rgba(102, 126, 234, 0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'
        }}>
          <h2 style={{ color: '#fff', margin: 0 }}>
            Logic Editor (v3.0) {editMode === 'study' && selectedStudyType ? `- ${selectedStudyType}` : ''}
          </h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Preview buttons - Only for tier 5 users (developer edition) */}
            {userTier >= 5 && (
              <>
                <button
                  onClick={() => setShowPromptPreview(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                  title="Preview the full AI prompt with all logic applied"
                >
                  Preview AI Prompt
                </button>
                {userTier >= 5 && (
                  <button
                    onClick={() => setShowGlobalSections(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#9b59b6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    title="Edit global findings and impression section rules (Tier 5 Developer only)"
                  >
                    Global Sections
                  </button>
                )}
                {userTier >= 5 && (
                  <button
                    onClick={() => setShowBasePrompt(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#95a5a6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    title="Preview the report base prompt without customizations"
                  >
                    Report Base Prompt
                  </button>
                )}
                {userTier >= 5 && (
                  <button
                    onClick={() => setShowImpressionPrompt(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#8e44ad',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    title="Preview the impression base prompt without customizations"
                  >
                    Impression Base Prompt
                  </button>
                )}
                {userTier >= 5 && (
                  <button
                    onClick={() => {
                      setStudyPromptPreviewText(generateStudyPromptPreview())
                      setShowStudyPromptPreview(true)
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#27ae60',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    title="Preview what study logic adds to the final prompt"
                  >
                    Study Logic Output
                  </button>
                )}
                {userTier >= 5 && (
                  <button
                    onClick={() => {
                      setBaseLogicPromptPreviewText(generateBaseLogicPromptPreview())
                      setShowBaseLogicPromptPreview(true)
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#2980b9',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                    title="Preview what base logic adds to the final prompt"
                  >
                    Base Logic Output
                  </button>
                )}
                {legacyLogic && (
                  <button
                    onClick={() => setShowLegacyLogic(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#e67e22',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                      marginLeft: 8
                    }}
                    title="View the legacy study-specific logic (before migration)"
                  >
                    View Legacy Logic
                  </button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: 24,
                cursor: 'pointer',
                marginLeft: 8
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setEditMode('base')}
              data-tooltip-id="base-logic-button"
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'base' ? '#3498db' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Base Logic
            </button>
            <button
              onClick={() => setEditMode('study')}
              data-tooltip-id="study-logic-button"
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'study' ? '#9b59b6' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Study Logic
            </button>
            <button
              onClick={() => setEditMode('preview')}
              data-tooltip-id="preview-merged-button"
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'preview' ? '#27ae60' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Preview Merged
            </button>
          </div>
          
          {/* Study Type Selector - Show in study and preview modes */}
          {(editMode === 'study' || editMode === 'preview') && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ color: '#aaa', fontSize: 13 }}>Study Type:</label>
              {editMode === 'study' ? (
                <select
                  value={selectedStudyType}
                  onChange={(e) => setSelectedStudyType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #3a3a3a',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 13,
                    minWidth: 150
                  }}
                >
                  {availableStudyTypes.length > 0 ? (
                    availableStudyTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))
                  ) : (
                    <option value="">No templates available</option>
                  )}
                </select>
              ) : (
                <span style={{ color: '#fff', fontSize: 13 }}>
                  {selectedStudyType || 'None selected'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 24
        }}>
          {isLoading ? (
            <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
              Loading...
            </div>
          ) : (
            editMode === 'study' ? renderStudySpecificLogic() : renderV3Logic()
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleReset}
              data-tooltip-id="reset-logic-button"
              style={{
                padding: '10px 20px',
                backgroundColor: showResetConfirm ? '#e74c3c' : '#95a5a6',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
              disabled={isLoading || editMode === 'preview'}
            >
              {showResetConfirm ? 'Confirm Reset?' : 'Reset to Default'}
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSave}
              data-tooltip-id="save-logic-button"
              style={{
                padding: '10px 30px',
                backgroundColor: '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
              disabled={isLoading || editMode === 'preview'}
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 30px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '12px 20px',
            backgroundColor: toastMessage.type === 'success' ? '#27ae60' : '#e74c3c',
            color: '#fff',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}>
            {toastMessage.text}
          </div>
        )}

        {/* Base Prompt Preview Modal */}
        {showBasePrompt && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '90%',
              maxWidth: 1200,
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Preview Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ color: '#fff', margin: 0 }}>
                    Base Prompt Preview
                    {globalBasePrompt && !customBasePrompt && (
                      <span style={{ 
                        marginLeft: 10, 
                        fontSize: 12, 
                        backgroundColor: '#9b59b6', 
                        padding: '2px 8px', 
                        borderRadius: 4,
                        fontWeight: 'normal'
                      }}>
                        GLOBAL
                      </span>
                    )}
                    {customBasePrompt && (
                      <span style={{ 
                        marginLeft: 10, 
                        fontSize: 12, 
                        backgroundColor: '#f39c12', 
                        padding: '2px 8px', 
                        borderRadius: 4,
                        fontWeight: 'normal'
                      }}>
                        CUSTOMIZED
                      </span>
                    )}
                  </h3>
                  <small style={{ color: '#888', fontSize: 12 }}>
                    {customBasePrompt 
                      ? 'Using your custom base prompt' 
                      : globalBasePrompt
                      ? 'Using global base prompt (applies to all users)'
                      : 'This is the minimal prompt without any logic customizations'}
                  </small>
                </div>
                <button
                  onClick={() => setShowBasePrompt(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Preview Content */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 24
              }}>
                {userTier >= 5 && (isEditingBasePrompt || isEditingGlobalPrompt) ? (
                  <textarea
                    value={isEditingGlobalPrompt ? (globalBasePrompt || getDefaultBasePrompt()) : (customBasePrompt || getDefaultBasePrompt())}
                    onChange={(e) => isEditingGlobalPrompt ? setGlobalBasePrompt(e.target.value) : setCustomBasePrompt(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '400px',
                      color: '#e0e0e0',
                      backgroundColor: '#0a0a0a',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      fontSize: 14,
                      lineHeight: 1.8,
                      border: '2px solid #333',
                      borderRadius: 6,
                      padding: 20,
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <pre style={{
                    color: '#ccc',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    {generateBasePrompt()}
                  </pre>
                )}
              </div>

              {/* Preview Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: userTier >= 5 ? 'space-between' : 'flex-end',
                gap: 12
              }}>
                {/* Left side buttons for tier 5 users */}
                {userTier >= 5 && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    {isEditingGlobalPrompt ? (
                      <>
                        <button
                          onClick={async () => {
                            // Save the global base prompt to database
                            const success = await updateGlobalBasePrompt(globalBasePrompt || getDefaultBasePrompt())
                            if (success) {
                              setIsEditingGlobalPrompt(false)
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#9b59b6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Save Global Prompt (All Users)
                        </button>
                        <button
                          onClick={() => {
                            // Cancel editing global prompt
                            fetchGlobalBasePrompt()
                            setIsEditingGlobalPrompt(false)
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#95a5a6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : isEditingBasePrompt ? (
                      <>
                        <button
                          onClick={() => {
                            // Save the custom base prompt
                            localStorage.setItem('customBasePrompt', customBasePrompt || getDefaultBasePrompt())
                            setIsEditingBasePrompt(false)
                            showToast('success', 'Custom base prompt saved')
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#27ae60',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            // Reset to default
                            setCustomBasePrompt(null)
                            localStorage.removeItem('customBasePrompt')
                            showToast('info', 'Reset to default base prompt')
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Reset to Default
                        </button>
                        <button
                          onClick={() => {
                            // Cancel editing
                            const savedPrompt = localStorage.getItem('customBasePrompt')
                            setCustomBasePrompt(savedPrompt)
                            setIsEditingBasePrompt(false)
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#95a5a6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditingBasePrompt(true)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#f39c12',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Edit My Prompt
                        </button>
                        <button
                          onClick={() => setIsEditingGlobalPrompt(true)}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#9b59b6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                          title="Edit the base prompt that applies to all users"
                        >
                          Edit Global Prompt
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Right side buttons */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateBasePrompt())
                      showToast('success', 'Base prompt copied to clipboard')
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3498db',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setShowBasePrompt(false)}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Impression Prompt Preview Modal */}
        {showImpressionPrompt && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '90%',
              maxWidth: 1200,
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Preview Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ color: '#fff', margin: 0 }}>
                    Impression Base Prompt Preview
                    <span style={{ 
                      marginLeft: 10, 
                      fontSize: 12, 
                      backgroundColor: '#8e44ad', 
                      padding: '2px 8px', 
                      borderRadius: 4,
                      fontWeight: 'normal'
                    }}>
                      GLOBAL
                    </span>
                  </h3>
                  <small style={{ color: '#888', display: 'block', marginTop: 4 }}>
                    This prompt is used for all impression generations across all users
                  </small>
                </div>
                <button
                  onClick={() => setShowImpressionPrompt(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Preview Content */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 24
              }}>
                {userTier >= 5 && isEditingImpressionPrompt ? (
                  <textarea
                    value={globalImpressionPrompt || getDefaultImpressionPrompt()}
                    onChange={(e) => setGlobalImpressionPrompt(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '400px',
                      color: '#e0e0e0',
                      backgroundColor: '#0a0a0a',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      fontSize: 14,
                      lineHeight: 1.8,
                      border: '2px solid #333',
                      borderRadius: 6,
                      padding: 20,
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ) : (
                  <pre style={{
                    color: '#ccc',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    margin: 0
                  }}>
                    {getDefaultImpressionPrompt()}
                  </pre>
                )}
              </div>

              {/* Preview Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                {userTier >= 5 && (
                  <div style={{
                    display: 'flex',
                    gap: 12
                  }}>
                    {isEditingImpressionPrompt ? (
                      <>
                        <button
                          onClick={async () => {
                            const success = await updateGlobalImpressionPrompt(globalImpressionPrompt || getDefaultImpressionPrompt())
                            if (success) {
                              setIsEditingImpressionPrompt(false)
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#8e44ad',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Save Global Impression Prompt
                        </button>
                        <button
                          onClick={() => {
                            // Cancel editing global prompt
                            fetchGlobalImpressionPrompt()
                            setIsEditingImpressionPrompt(false)
                          }}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#95a5a6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingImpressionPrompt(true)}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#8e44ad',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer'
                        }}
                        title="Edit the impression prompt that applies to all users"
                      >
                        Edit Global Impression Prompt
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getDefaultImpressionPrompt())
                    showToast('success', 'Impression prompt copied to clipboard')
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3498db',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setShowImpressionPrompt(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Sections Modal */}
        {showGlobalSections && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '90%',
              maxWidth: 1200,
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
                  Global Findings & Impression Section Rules {userTier !== 4 && '(Read-only)'}
                </h2>
                <button
                  onClick={() => setShowGlobalSections(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#999',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div style={{
                flex: 1,
                padding: 24,
                overflowY: 'auto',
                display: 'flex',
                gap: 24
              }}>
                {/* Global Findings Rules */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    color: '#3ABC96', 
                    marginBottom: 16,
                    fontSize: 18,
                    borderBottom: '2px solid rgba(58, 188, 150, 0.3)',
                    paddingBottom: 8
                  }}>
                    Global Findings Rules
                  </h3>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#999', 
                    marginBottom: 16,
                    padding: '10px 14px',
                    backgroundColor: 'rgba(58, 188, 150, 0.1)',
                    borderRadius: 6,
                    border: '1px solid rgba(58, 188, 150, 0.2)'
                  }}>
                    These rules are applied to ALL reports across ALL study types
                  </div>
                  {isEditingGlobalFindingsRules ? (
                    <textarea
                      value={typeof globalFindingsRules === 'string' 
                        ? globalFindingsRules 
                        : globalFindingsRules?.text || ''}
                      onChange={(e) => {
                        setGlobalFindingsRules({ text: e.target.value })
                      }}
                      style={{
                        width: '100%',
                        height: 400,
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        padding: 12,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: 14,
                        lineHeight: 1.6,
                        resize: 'none'
                      }}
                      placeholder={`Enter global findings rules that apply to ALL reports.

Examples:
• Always include measurement units (e.g., cm, mm)
• Use consistent anatomical terminology
• Describe location relative to known landmarks
• Report bilateral findings in a standardized format
• Include comparison to prior studies when available

Corrections (use "Replace X with Y" format):
• Replace "hyperintense" with "high signal intensity"
• Replace "hypointense" with "low signal intensity"
• Replace "enlarged" with specific measurements when possible

Custom Rules:
• Any other rules you want applied to all findings sections...`}
                    />
                  ) : (
                    <pre style={{
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid #3a3a3a',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      fontSize: 14,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: 1.6,
                      height: 400,
                      overflowY: 'auto'
                    }}>
                      {globalFindingsRules?.text || globalFindingsRules || 'No global findings rules configured'}
                    </pre>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    {isEditingGlobalFindingsRules ? (
                      <>
                        <button
                          onClick={async () => {
                            const success = await updateGlobalFindingsRules(globalFindingsRules)
                            if (success) {
                              setIsEditingGlobalFindingsRules(false)
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#3ABC96',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            fetchGlobalPromptSections()
                            setIsEditingGlobalFindingsRules(false)
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : userTier >= 5 ? (
                      <button
                        onClick={() => setIsEditingGlobalFindingsRules(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3498db',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        Edit Rules
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Global Impression Rules */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    color: '#9b59b6', 
                    marginBottom: 16,
                    fontSize: 18,
                    borderBottom: '2px solid rgba(155, 89, 182, 0.3)',
                    paddingBottom: 8
                  }}>
                    Global Impression Rules
                  </h3>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#999', 
                    marginBottom: 16,
                    padding: '10px 14px',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderRadius: 6,
                    border: '1px solid rgba(155, 89, 182, 0.2)'
                  }}>
                    These rules are applied to ALL impressions across ALL study types
                  </div>
                  {isEditingGlobalImpressionRules ? (
                    <textarea
                      value={typeof globalImpressionRules === 'string' 
                        ? globalImpressionRules 
                        : globalImpressionRules?.text || ''}
                      onChange={(e) => {
                        setGlobalImpressionRules({ text: e.target.value })
                      }}
                      style={{
                        width: '100%',
                        height: 400,
                        backgroundColor: '#2a2a2a',
                        color: '#fff',
                        border: '1px solid #3a3a3a',
                        borderRadius: 4,
                        padding: 12,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: 14,
                        lineHeight: 1.6,
                        resize: 'none'
                      }}
                      placeholder={`Enter global impression rules that apply to ALL impressions.

General Rules:
• Always prioritize clinically significant findings
• Include follow-up recommendations when appropriate
• Use clear, concise language avoiding medical jargon when possible
• Group related findings together
• Lead with the most important findings

Exclusions (items to omit from impressions):
• Mild degenerative changes (unless symptomatic)
• Small simple cysts (unless relevant to clinical question)
• Minimal joint effusions (unless moderate or large)
• Age-appropriate changes

Priority Keywords (findings to list first):
• Fracture
• Hemorrhage
• Mass/tumor
• Infection/abscess
• Acute findings

Custom Rules:
• Any other rules you want applied to all impression sections...`}
                    />
                  ) : (
                    <pre style={{
                      backgroundColor: '#2a2a2a',
                      color: '#fff',
                      padding: 12,
                      borderRadius: 4,
                      border: '1px solid #3a3a3a',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      fontSize: 14,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: 1.6,
                      height: 400,
                      overflowY: 'auto'
                    }}>
                      {globalImpressionRules?.text || globalImpressionRules || 'No global impression rules configured'}
                    </pre>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    {isEditingGlobalImpressionRules && userTier >= 5 ? (
                      <>
                        <button
                          onClick={async () => {
                            console.log('💾 Saving global impression rules:', globalImpressionRules);
                            const success = await updateGlobalImpressionRules(globalImpressionRules)
                            if (success) {
                              console.log('✅ Global impression rules saved successfully');
                              setIsEditingGlobalImpressionRules(false)
                            } else {
                              console.error('❌ Failed to save global impression rules');
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#9b59b6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            fetchGlobalPromptSections()
                            setIsEditingGlobalImpressionRules(false)
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : userTier >= 5 ? (
                      <button
                        onClick={() => setIsEditingGlobalImpressionRules(true)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#3498db',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        Edit Rules
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowGlobalSections(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legacy Logic Modal */}
        {showLegacyLogic && legacyLogic && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '80%',
              maxWidth: 800,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ color: '#e67e22', margin: 0 }}>
                  Legacy Study-Specific Logic ({selectedStudyType})
                </h3>
                <button
                  onClick={() => setShowLegacyLogic(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
              
              {/* Content */}
              <div style={{
                flex: 1,
                padding: '20px 24px',
                overflowY: 'auto'
              }}>
                <div style={{
                  padding: 12,
                  backgroundColor: '#2a2a2a',
                  borderRadius: 4,
                  marginBottom: 12,
                  border: '1px solid #e67e22'
                }}>
                  <p style={{ color: '#e67e22', fontSize: 13, marginBottom: 10 }}>
                    ⚠️ This is the original agent_logic column data before migration to the new v3.0 schema.
                  </p>
                  <p style={{ color: '#aaa', fontSize: 12 }}>
                    This logic is no longer actively used for report generation. The system now uses the separated 
                    base logic and study-specific logic (agent_logic_2).
                  </p>
                </div>
                <pre style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#aaa',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: '#0a0a0a',
                  padding: 16,
                  borderRadius: 4,
                  border: '1px solid #333'
                }}>
                  {JSON.stringify(legacyLogic, null, 2)}
                </pre>
              </div>
              
              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowLegacyLogic(false)}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#333',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Preview Modal */}
        {showPromptPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '80%',
              maxWidth: 800,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Preview Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ color: '#fff', margin: 0 }}>
                    AI Prompt Preview
                  </h3>
                  <small style={{ color: '#888', fontSize: 12 }}>
                    Full prompt with all logic customizations applied
                  </small>
                </div>
                <button
                  onClick={() => setShowPromptPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Preview Content */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 24
              }}>
                <pre style={{
                  color: '#ccc',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  margin: 0
                }}>
                  {generatePromptPreview()}
                </pre>
              </div>

              {/* Preview Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatePromptPreview())
                    showToast('success', 'Prompt copied to clipboard')
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3498db',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => setShowPromptPreview(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Modal for adding items */}
        {inputModal.show && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              padding: 24,
              width: 400,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <h3 style={{ color: '#3ABC96', marginTop: 0, marginBottom: 16 }}>
                Add {inputModal.label}
              </h3>
              <input
                type="text"
                value={inputModal.value}
                onChange={(e) => setInputModal({ ...inputModal, value: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    if (inputModal.value.trim()) {
                      // Get current items
                      let current: any = displayLogic
                      for (let i = 0; i < inputModal.path.length - 1; i++) {
                        current = current?.[inputModal.path[i]]
                      }
                      const actualItems = current?.[inputModal.path[inputModal.path.length - 1]] ?? []
                      
                      // Add new item
                      const updatedItems = [...actualItems, inputModal.value.trim()]
                      updateLogicValue(inputModal.path, updatedItems)
                      
                      // Close modal
                      setInputModal({ show: false, path: [], label: '', value: '' })
                    }
                  }
                }}
                placeholder={`Enter ${inputModal.label.toLowerCase()}...`}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #3a3a3a',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 14,
                  marginBottom: 16
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setInputModal({ show: false, path: [], label: '', value: '' })}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (inputModal.value.trim()) {
                      // Get current items
                      let current: any = displayLogic
                      for (let i = 0; i < inputModal.path.length - 1; i++) {
                        current = current?.[inputModal.path[i]]
                      }
                      const actualItems = current?.[inputModal.path[inputModal.path.length - 1]] ?? []
                      
                      // Add new item
                      const updatedItems = [...actualItems, inputModal.value.trim()]
                      updateLogicValue(inputModal.path, updatedItems)
                      
                      // Close modal
                      setInputModal({ show: false, path: [], label: '', value: '' })
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3ABC96',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Study Logic Prompt Preview Modal */}
        {showStudyPromptPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '90%',
              maxWidth: 1200,
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0, color: '#27ae60' }}>Study Logic Output Preview</h2>
                <button
                  onClick={() => setShowStudyPromptPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#aaa',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{
                flex: 1,
                padding: '20px 24px',
                overflowY: 'auto'
              }}>
                <div style={{
                  padding: 12,
                  backgroundColor: '#2a2a2a',
                  borderRadius: 4,
                  marginBottom: 12,
                  border: '1px solid #27ae60'
                }}>
                  <p style={{ color: '#27ae60', fontSize: 13, margin: 0 }}>
                    This shows exactly what the study-specific logic contributes to the final prompt.
                  </p>
                </div>
                <pre style={{
                  fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                  fontSize: 14,
                  color: '#e0e0e0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: '#0a0a0a',
                  padding: 20,
                  borderRadius: 4,
                  border: '1px solid #333',
                  lineHeight: 1.5
                }}>
                  {studyPromptPreviewText || 'No study-specific logic to display'}
                </pre>
              </div>
              
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowStudyPromptPreview(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Base Logic Prompt Preview Modal */}
        {showBaseLogicPromptPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: 8,
              width: '90%',
              maxWidth: 1200,
              height: '90vh',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0, color: '#2980b9' }}>Base Logic Output Preview</h2>
                <button
                  onClick={() => setShowBaseLogicPromptPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#aaa',
                    fontSize: 24,
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{
                flex: 1,
                padding: '20px 24px',
                overflowY: 'auto'
              }}>
                <div style={{
                  padding: 12,
                  backgroundColor: '#2a2a2a',
                  borderRadius: 4,
                  marginBottom: 12,
                  border: '1px solid #2980b9'
                }}>
                  <p style={{ color: '#2980b9', fontSize: 13, margin: 0 }}>
                    This shows exactly what the base logic contributes to the final prompt.
                  </p>
                </div>
                <pre style={{
                  fontFamily: 'JetBrains Mono, Monaco, Consolas, monospace',
                  fontSize: 14,
                  color: '#e0e0e0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: '#0a0a0a',
                  padding: 20,
                  borderRadius: 4,
                  border: '1px solid #333',
                  lineHeight: 1.5
                }}>
                  {baseLogicPromptPreviewText || 'No base logic to display'}
                </pre>
              </div>
              
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowBaseLogicPromptPreview(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2a2a2a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}