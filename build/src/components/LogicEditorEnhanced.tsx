import React, { useState, useEffect } from 'react'
import { 
  fetchAgentLogic, 
  updateBaseLogic, 
  updateStudyLogic, 
  resetLogic,
  getMergedLogicForPrompt 
} from '../supabase/agentLogicQueriesIPC'
import { getLogicDiffSummary, getLogicSource, LogicLayers } from '../utils/logicInheritance'
import { getDefaultAgentLogic } from '../utils/logicMerge'

interface LogicEditorEnhancedProps {
  userId: string
  studyType: string
  templates?: Record<string, any>
  onClose: () => void
  isOfflineMode?: boolean
  userTier?: number
}

type EditMode = 'base' | 'study' | 'preview'

const getNestedValue = (obj: any, path: string[]): any => {
  let current = obj
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return current
}

export default function LogicEditorEnhanced({ 
  userId, 
  studyType, 
  templates = {}, 
  onClose, 
  isOfflineMode = false,
  userTier = 1 
}: LogicEditorEnhancedProps) {
  const [selectedStudyType, setSelectedStudyType] = useState<string>(studyType)
  const [editMode, setEditMode] = useState<EditMode>('study')
  const [isLoading, setIsLoading] = useState(false)
  const [baseLogic, setBaseLogic] = useState<any>(null)
  const [studyLogic, setStudyLogic] = useState<any>(null)
  const [mergedLogic, setMergedLogic] = useState<any>(null)
  const [displayLogic, setDisplayLogic] = useState<any>(null)
  const [pendingChanges, setPendingChanges] = useState<any>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<{ base?: string, study?: string }>({})
  const [showDiffView, setShowDiffView] = useState(false)
  const [logicLayers, setLogicLayers] = useState<LogicLayers>({})
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [showAddRule, setShowAddRule] = useState<string | null>(null)
  const [newRuleName, setNewRuleName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string[], type: 'section' | 'rule' } | null>(null)
  const [showAddInstruction, setShowAddInstruction] = useState(false)
  const [newInstruction, setNewInstruction] = useState('')
  const [editingInstruction, setEditingInstruction] = useState<{ index: number, value: string } | null>(null)
  const [showAddArrayItem, setShowAddArrayItem] = useState<string | null>(null)
  const [newArrayItem, setNewArrayItem] = useState('')
  const [showPromptPreview, setShowPromptPreview] = useState(false)

  // Load logic when component mounts or study type changes
  useEffect(() => {
    if (selectedStudyType && selectedStudyType.trim()) {
      console.log('📚 Loading logic for study type:', selectedStudyType)
      loadLogic()
    } else {
      console.log('⚠️ No study type selected, skipping logic load')
      // Still load base logic even without study type
      loadBaseLogicOnly()
    }
  }, [selectedStudyType, userId])

  // Update display logic when edit mode changes
  useEffect(() => {
    switch (editMode) {
      case 'base':
        setDisplayLogic(baseLogic || getDefaultAgentLogic())
        break
      case 'study':
        setDisplayLogic(studyLogic || {})
        break
      case 'preview':
        setDisplayLogic(mergedLogic)
        break
    }
  }, [editMode, baseLogic, studyLogic, mergedLogic])

  const loadLogic = async () => {
    setIsLoading(true)
    try {
      const result = await fetchAgentLogic(userId, selectedStudyType, isOfflineMode)
      if (result.success) {
        setBaseLogic(result.baseLogic || getDefaultAgentLogic())
        setStudyLogic(result.studyLogic || {})
        setMergedLogic(result.mergedLogic || getDefaultAgentLogic())
        setLastUpdated(result.lastUpdated || {})
        setLogicLayers({
          defaultLogic: getDefaultAgentLogic(),
          baseLogic: result.baseLogic,
          studySpecificLogic: result.studyLogic
        })
      }
    } catch (error) {
      console.error('Error loading logic:', error)
      showToast('error', 'Failed to load logic configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const loadBaseLogicOnly = async () => {
    setIsLoading(true)
    try {
      // Use a dummy study type to fetch just the base logic
      const result = await fetchAgentLogic(userId, 'DUMMY_FOR_BASE', isOfflineMode)
      if (result.success) {
        setBaseLogic(result.baseLogic || getDefaultAgentLogic())
        setStudyLogic({})
        setMergedLogic(result.baseLogic || getDefaultAgentLogic())
        setLastUpdated({ base: result.lastUpdated?.base })
        setLogicLayers({
          defaultLogic: getDefaultAgentLogic(),
          baseLogic: result.baseLogic,
          studySpecificLogic: {}
        })
      }
    } catch (error) {
      console.error('Error loading base logic:', error)
      // Use defaults
      const defaultLogic = getDefaultAgentLogic()
      setBaseLogic(defaultLogic)
      setStudyLogic({})
      setMergedLogic(defaultLogic)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogicChange = (path: string[], newValue: any) => {
    // Process value (convert spaces to underscores for strings/arrays)
    let processedValue = newValue
    if (typeof newValue === 'string') {
      processedValue = newValue.replace(/\s+/g, '_').toLowerCase()
    } else if (Array.isArray(newValue)) {
      processedValue = newValue.map(item => 
        typeof item === 'string' ? item.replace(/\s+/g, '_').toLowerCase() : item
      )
    }

    // Update the appropriate logic based on edit mode
    const updateLogic = (prevLogic: any) => {
      const updatedLogic = JSON.parse(JSON.stringify(prevLogic || {}))
      let current = updatedLogic
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {}
        }
        current = current[path[i]]
      }
      current[path[path.length - 1]] = processedValue
      return updatedLogic
    }

    if (editMode === 'base') {
      setBaseLogic(updateLogic)
    } else if (editMode === 'study') {
      setStudyLogic(updateLogic)
    }

    // Track pending changes
    setPendingChanges(prev => ({
      ...prev,
      [editMode]: true
    }))
  }

  const addSection = () => {
    if (!newSectionName.trim()) return
    
    const sectionKey = newSectionName.replace(/\s+/g, '_').toLowerCase()
    const newSection: any = {}
    
    // Add exclude_by_default for impression-related sections
    if (sectionKey.includes('impression')) {
      newSection.exclude_by_default = []
    }
    
    handleLogicChange([sectionKey], newSection)
    setNewSectionName('')
    setShowAddSection(false)
    showToast('success', `Section '${newSectionName}' added`)
  }

  const addRule = (sectionPath: string[]) => {
    if (!newRuleName.trim()) return
    
    const ruleKey = newRuleName.replace(/\s+/g, '_').toLowerCase()
    handleLogicChange([...sectionPath, ruleKey], false) // Default to boolean false
    setNewRuleName('')
    setShowAddRule(null)
    showToast('success', `Rule '${newRuleName}' added`)
  }

  const deleteItem = () => {
    if (!deleteConfirm) return
    
    const updateLogic = (prevLogic: any) => {
      const updatedLogic = JSON.parse(JSON.stringify(prevLogic || {}))
      
      if (deleteConfirm.path.length === 1) {
        // Delete top-level section
        delete updatedLogic[deleteConfirm.path[0]]
      } else {
        // Navigate to parent and delete the item
        let current = updatedLogic
        for (let i = 0; i < deleteConfirm.path.length - 2; i++) {
          current = current[deleteConfirm.path[i]]
        }
        delete current[deleteConfirm.path[deleteConfirm.path.length - 2]][deleteConfirm.path[deleteConfirm.path.length - 1]]
      }
      
      return updatedLogic
    }
    
    if (editMode === 'base') {
      setBaseLogic(updateLogic)
    } else if (editMode === 'study') {
      setStudyLogic(updateLogic)
    }
    
    setPendingChanges(prev => ({ ...prev, [editMode]: true }))
    setDeleteConfirm(null)
    showToast('success', `${deleteConfirm.type === 'section' ? 'Section' : 'Rule'} deleted`)
  }

  const addCustomInstruction = () => {
    if (!newInstruction.trim()) return
    
    const currentInstructions = getNestedValue(displayLogic, ['custom_instructions']) || []
    handleLogicChange(['custom_instructions'], [...currentInstructions, newInstruction.trim()])
    setNewInstruction('')
    setShowAddInstruction(false)
    showToast('success', 'Custom instruction added')
  }

  const removeCustomInstruction = (index: number) => {
    const currentInstructions = getNestedValue(displayLogic, ['custom_instructions']) || []
    const updated = currentInstructions.filter((_, i) => i !== index)
    handleLogicChange(['custom_instructions'], updated)
    showToast('success', 'Custom instruction removed')
  }

  const updateCustomInstruction = (index: number, newValue: string) => {
    if (!newValue.trim()) {
      removeCustomInstruction(index)
      return
    }
    const currentInstructions = getNestedValue(displayLogic, ['custom_instructions']) || []
    const updated = [...currentInstructions]
    updated[index] = newValue.trim()
    handleLogicChange(['custom_instructions'], updated)
    setEditingInstruction(null)
    showToast('success', 'Custom instruction updated')
  }

  const addArrayItem = (path: string[], item: string) => {
    if (!item.trim()) return
    // Don't process custom_instructions - keep them as human-readable text
    const processedItem = path[path.length - 1] === 'custom_instructions' 
      ? item.trim()
      : item.trim().replace(/\s+/g, '_').toLowerCase()
    const currentArray = getNestedValue(displayLogic, path) || []
    handleLogicChange(path, [...currentArray, processedItem])
    setNewArrayItem('')
    setShowAddArrayItem(null)
    showToast('success', 'Item added')
  }

  const removeArrayItem = (path: string[], index: number) => {
    const currentArray = getNestedValue(displayLogic, path) || []
    const updated = currentArray.filter((_, i) => i !== index)
    handleLogicChange(path, updated)
    showToast('success', 'Item removed')
  }

  const generatePromptPreview = () => {
    const logic = displayLogic || getDefaultAgentLogic()
    
    // This mirrors the EXACT prompt from buildEnhancedPrompt.ts
    let prompt = 'You are an expert radiologist generating a comprehensive radiology report.\n\n'
    
    // Template section (EXACTLY as sent to API)
    const template = templates && templates[selectedStudyType] 
      ? templates[selectedStudyType].template 
      : '[Template will be inserted here]'
    
    if (template) {
      prompt += 'TEMPLATE STRUCTURE - MANDATORY COMPLIANCE:\n\n'
      prompt += template + '\n\n'
      prompt += 'CRITICAL: Preserve ALL section headers (text ending with ":") EXACTLY as shown above. Any deviation from the template structure will be considered an error.\n\n'
      prompt += 'CRITICAL SPACING RULE: Always include a space after colons in section headers (e.g., "Neurovascular structures: Unremarkable" NOT "Neurovascular structures:Unremarkable"). This spacing is mandatory and must be preserved exactly as shown in the template.\n\n'
    }
    
    // Findings section (placeholder for preview)
    prompt += 'MANDATORY FINDINGS INCORPORATION:\n\n'
    prompt += '=== FINDINGS TO INCORPORATE ===\n'
    prompt += '[YOUR DICTATED FINDINGS WILL BE INSERTED HERE]\n'
    prompt += '=== END OF FINDINGS ===\n\n'
    prompt += 'CRITICAL REQUIREMENT: Every single finding above MUST appear in the appropriate section of your report. Omitting any finding is unacceptable.\n\n'
    
    // Build rules EXACTLY as in buildEnhancedPrompt.ts
    const criticalRules: string[] = []
    const formattingRules: string[] = []
    const contentRules: string[] = []
    
    // Process impression rules (highest priority)
    if (logic.impression) {
      if (logic.impression.numerically_itemized) {
        criticalRules.push('IMPRESSION FORMATTING: The impression section MUST be formatted as a numbered list (1, 2, 3, etc.). This is non-negotiable.')
        criticalRules.push('IMPRESSION SPACING: Separate each numbered item with a double line break.')
      } else if (logic.formatting?.use_bullet_points) {
        criticalRules.push('IMPRESSION FORMATTING: The impression section MUST be formatted as a bullet point list using • symbols.')
        criticalRules.push('IMPRESSION SPACING: Separate each bullet point with a double line break.')
        criticalRules.push('BULLET FORMAT: Start each item with "• " followed by the diagnosis/finding.')
      } else {
        formattingRules.push('IMPRESSION SPACING: Write the impression as separate statements, each separated by a double line break.')
      }
      
      if (logic.impression.exclude_by_default && Array.isArray(logic.impression.exclude_by_default) && logic.impression.exclude_by_default.length > 0) {
        const readableExclusions = logic.impression.exclude_by_default.map((item: string) => 
          item.replace(/_/g, ' ').toLowerCase()
        )
        
        criticalRules.push('════════════════════════════════════════════')
        criticalRules.push('⚠️ MANDATORY EXCLUSION RULES FOR IMPRESSION:')
        readableExclusions.forEach((exclusion: string) => {
          criticalRules.push(`❌ DO NOT include "${exclusion}" in the impression section`)
        })
        if (readableExclusions.some((e: string) => e.includes('baker'))) {
          criticalRules.push('❌ SPECIFICALLY: Never mention "Small Baker\'s cyst" or any small Baker cyst in the impression')
        }
        criticalRules.push('════════════════════════════════════════════')
        criticalRules.push('These exclusions are MANDATORY unless causing active symptoms.')
      }
      
      if (logic.impression.first_item_should_address_clinical_concern) {
        criticalRules.push('CLINICAL FOCUS: The first item in the impression MUST directly address the primary clinical concern or indication.')
      }
      
      if (logic.impression.omit_minor_or_incidental_findings_unless_relevant) {
        contentRules.push('Focus the impression on clinically significant findings. Omit mild or incidental findings unless they relate to the clinical history.')
      }
      
      if (logic.impression.concise_summary) {
        contentRules.push('Keep the impression concise and focused on the most important findings.')
      }
      
      if (logic.impression.include_recommendations) {
        contentRules.push('Include specific follow-up recommendations when clinically appropriate.')
      }
      
      // Handle mention_muscle_atrophy_if
      if (logic.impression.mention_muscle_atrophy_if) {
        if (logic.impression.mention_muscle_atrophy_if === 'moderate_or_severe') {
          criticalRules.push('MUSCLE ATROPHY RULE: Only mention muscle atrophy if it is explicitly described as moderate or severe. Do not mention mild muscle atrophy.')
        } else if (logic.impression.mention_muscle_atrophy_if === 'severe') {
          criticalRules.push('MUSCLE ATROPHY RULE: Only mention muscle atrophy if it is explicitly described as severe. Do not mention mild or moderate muscle atrophy.')
        } else if (logic.impression.mention_muscle_atrophy_if === 'never') {
          criticalRules.push('MUSCLE ATROPHY RULE: Do NOT mention muscle atrophy regardless of severity.')
        }
      }
    }
    
    // Process formatting rules
    if (logic.formatting) {
      if (logic.formatting.preserve_template_punctuation) {
        criticalRules.push('CRITICAL: Preserve ALL punctuation, spacing, and formatting EXACTLY as shown in the template. This includes spaces after colons (e.g., "Section: Content" not "Section:Content"), proper line breaks, and all other spacing.')
      }
      if (logic.formatting.use_bullet_points) {
        formattingRules.push('Use bullet points for listing multiple findings within each section.')
      }
      if (logic.formatting.capitalize_sections) {
        formattingRules.push('Ensure all section headers are in UPPERCASE.')
      }
    }
    
    // Process report-specific rules
    if (logic.report) {
      if (logic.report.no_hallucinated_findings) {
        criticalRules.push('ACCURACY RULE: Do not invent, assume, or hallucinate any findings. Only report what is explicitly stated in the provided findings.')
      }
      
      // Handle cartilage placement
      if (logic.report.cartilage_placement) {
        if (logic.report.cartilage_placement.trochlear_cartilage_in_patellofemoral) {
          criticalRules.push('CARTILAGE PLACEMENT: Trochlear cartilage findings MUST be described within the patellofemoral compartment section.')
        }
        if (logic.report.cartilage_placement.mention_patellar_if_trochlear_defect_present) {
          criticalRules.push('CARTILAGE CORRELATION: If any trochlear defect is present, you MUST explicitly state the condition of the patellar cartilage (intact or abnormal).')
        }
      }
      
      if (logic.report.expand_lesions) {
        contentRules.push('For each lesion, describe location, size, morphology, and enhancement characteristics when available.')
      }
    }
    
    // Process clinical rules
    if (logic.clinical) {
      if (logic.clinical.correlate_with_symptoms) {
        contentRules.push('Correlate findings with clinical symptoms when clinical history is provided.')
      }
      if (logic.clinical.mention_clinical_significance) {
        contentRules.push('Comment on the clinical significance of major findings.')
      }
    }
    
    // Process measurement rules
    if (logic.measurements) {
      if (logic.measurements.include_all_measurements) {
        formattingRules.push('Include all measurements mentioned in the findings.')
      }
      if (logic.measurements.use_metric_system) {
        formattingRules.push('Use metric system (mm, cm) for all measurements.')
      }
    }
    
    // Process anatomy rules
    if (logic.anatomy) {
      if (logic.anatomy.combine_meniscus_and_cartilage_findings) {
        contentRules.push('Combine meniscus and cartilage findings in the same section for better organization.')
      }
      if (logic.anatomy.group_by_anatomic_region) {
        contentRules.push('Group findings by anatomic region (e.g., anterior, posterior, medial, lateral).')
      }
    }
    
    // Process severity rules
    if (logic.severity) {
      if (logic.severity.use_standard_grading) {
        formattingRules.push('Use standard grading systems (e.g., mild/moderate/severe) consistently.')
      }
      if (logic.severity.avoid_vague_terms) {
        formattingRules.push('Avoid vague terms like "some" or "several" - be specific.')
      }
    }
    
    // Process style rules
    if (logic.style) {
      if (logic.style.active_voice) {
        contentRules.push('Use active voice when describing findings.')
      }
      if (logic.style.professional_tone) {
        contentRules.push('Maintain a professional, objective tone throughout.')
      }
    }
    
    // Add custom instructions
    if (logic.custom_instructions) {
      if (Array.isArray(logic.custom_instructions)) {
        logic.custom_instructions.forEach((instruction: string) => {
          criticalRules.push(`CUSTOM RULE: ${instruction}`)
        })
      } else if (typeof logic.custom_instructions === 'string') {
        criticalRules.push(`CUSTOM RULE: ${logic.custom_instructions}`)
      }
    }
    
    // Build the prompt with prioritized rules (EXACTLY as in buildEnhancedPrompt.ts)
    if (criticalRules.length > 0) {
      prompt += 'CRITICAL RULES - MUST BE FOLLOWED:\n'
      criticalRules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }
    
    if (formattingRules.length > 0) {
      prompt += 'FORMATTING REQUIREMENTS:\n'
      formattingRules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }
    
    if (contentRules.length > 0) {
      prompt += 'CONTENT GUIDELINES:\n'
      contentRules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }
    
    // Add examples if provided
    if (logic.examples && Array.isArray(logic.examples)) {
      prompt += 'EXAMPLES:\n'
      logic.examples.forEach((example: any, index: number) => {
        if (example.context) {
          prompt += `Example ${index + 1} (${example.context}):\n`
        } else {
          prompt += `Example ${index + 1}:\n`
        }
        if (example.input) {
          prompt += `Input: ${example.input}\n`
        }
        if (example.output) {
          prompt += `Output: ${example.output}\n`
        }
        prompt += '\n'
      })
    }
    
    // Final requirements (EXACTLY as in buildEnhancedPrompt.ts)
    prompt += 'FINAL REQUIREMENTS:\n'
    prompt += '1. Use the EXACT section headers from the template (preserve all text ending with ":")\n'
    prompt += '2. Incorporate EVERY SINGLE finding from the "=== FINDINGS TO INCORPORATE ===" section\n'
    prompt += '3. Follow ALL critical rules above without exception\n'
    prompt += '4. Apply formatting requirements consistently\n'
    prompt += '5. Write natural, clinically accurate content within each section\n'
    
    // Add specific impression formatting requirements
    if (logic.impression?.numerically_itemized) {
      prompt += '6. IMPRESSION FORMATTING: Use numbered list format (1, 2, 3, etc.) with double line breaks between items.\n'
    } else if (logic.formatting?.use_bullet_points) {
      prompt += '6. IMPRESSION FORMATTING: Use bullet point format (• symbol) with double line breaks between items.\n'
    } else {
      prompt += '6. IMPRESSION FORMATTING: Use paragraph format with double line breaks between separate statements.\n'
    }
    
    prompt += '\nGenerate the complete radiology report now. Focus on accuracy and proper formatting as specified above.\n'
    
    return prompt
  }

  const savePendingChanges = async () => {
    if (!pendingChanges) return

    setIsLoading(true)
    try {
      if (pendingChanges.base && baseLogic) {
        const result = await updateBaseLogic(userId, baseLogic, isOfflineMode)
        if (result.success) {
          showToast('success', 'Base logic saved successfully')
        } else {
          throw new Error(result.error)
        }
      }

      if (pendingChanges.study && studyLogic) {
        const result = await updateStudyLogic(userId, selectedStudyType, studyLogic, isOfflineMode, true)
        if (result.success) {
          showToast('success', 'Study-specific logic saved successfully')
        } else {
          throw new Error(result.error)
        }
      }

      setPendingChanges(null)
      await loadLogic() // Reload to get merged logic
    } catch (error) {
      showToast('error', `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      // Restore focus to prevent UI becoming unresponsive
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
        // Re-focus the body to ensure event listeners work
        document.body.focus();
        // Then focus the editor if it exists
        const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editor) {
          editor.focus();
        }
      }, 100);
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    try {
      const result = await resetLogic(userId, selectedStudyType, editMode as 'base' | 'study', isOfflineMode)
      if (result.success) {
        showToast('success', `${editMode === 'base' ? 'Base' : 'Study'} logic reset to default`)
        await loadLogic()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      showToast('error', `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setShowResetConfirm(false)
      // Restore focus to prevent UI becoming unresponsive
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
        document.body.focus();
        const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
        if (editor) {
          editor.focus();
        }
      }, 100);
    }
  }

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const renderLogicSection = (obj: any, path: string[] = [], isReadOnly: boolean = false) => {
    if (!obj || typeof obj !== 'object') return null

    // Ensure all impression-related sections have exclude_by_default
    Object.keys(obj).forEach(key => {
      if (key.includes('impression') && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        if (!obj[key].exclude_by_default) {
          obj[key].exclude_by_default = []
        }
      }
    })

    return Object.entries(obj).map(([key, value]) => {
      const currentPath = [...path, key]
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      
      // Get source of this setting
      const source = editMode === 'preview' ? getLogicSource(currentPath, logicLayers) : null
      const sourceColor = {
        'default': '#888',
        'base': '#3498db',
        'study': '#9b59b6'
      }[source || 'default']

      return (
        <div key={currentPath.join('.')} style={{ marginLeft: path.length * 20, marginBottom: 8 }}>
          {typeof value === 'object' && !Array.isArray(value) ? (
            <div>
              <h4 style={{ 
                color: '#3ABC96', 
                fontSize: 14, 
                fontWeight: 600, 
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {formattedKey}
                {source && editMode === 'preview' && (
                  <span style={{ 
                    fontSize: 10, 
                    color: sourceColor,
                    fontWeight: 400,
                    padding: '2px 6px',
                    backgroundColor: `${sourceColor}20`,
                    borderRadius: 4
                  }}>
                    from {source}
                  </span>
                )}
                {!isReadOnly && editMode !== 'preview' && (
                  <>
                    <button
                      onClick={() => setShowAddRule(currentPath.join('.'))}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        backgroundColor: '#27ae60',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Rule
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ path: currentPath, type: 'section' })}
                      style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        backgroundColor: '#e74c3c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Delete Section
                    </button>
                  </>
                )}
              </h4>
              {showAddRule === currentPath.join('.') && (
                <div style={{ 
                  marginBottom: 12, 
                  padding: 12, 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 6
                }}>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="Enter rule name..."
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: 4,
                      marginRight: 8,
                      width: 200
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && addRule(currentPath)}
                  />
                  <button
                    onClick={() => addRule(currentPath)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#27ae60',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      marginRight: 8
                    }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddRule(null); setNewRuleName(''); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {renderLogicSection(value, currentPath, isReadOnly)}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ 
                color: '#ccc', 
                fontSize: 12, 
                minWidth: 150,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {formattedKey}:
                {source && editMode === 'preview' && (
                  <span style={{ 
                    fontSize: 9, 
                    color: sourceColor,
                    padding: '1px 4px',
                    backgroundColor: `${sourceColor}20`,
                    borderRadius: 3
                  }}>
                    {source}
                  </span>
                )}
                {!isReadOnly && editMode !== 'preview' && key !== 'custom_instructions' && (
                  <button
                    onClick={() => setDeleteConfirm({ path: currentPath, type: 'rule' })}
                    style={{
                      padding: '2px 6px',
                      fontSize: 10,
                      backgroundColor: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      marginLeft: 8
                    }}
                  >
                    Delete
                  </button>
                )}
              </span>
              {isReadOnly ? (
                <span style={{ color: '#fff', fontSize: 12 }}>
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </span>
              ) : typeof value === 'boolean' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleLogicChange(currentPath, e.target.checked)}
                    disabled={isReadOnly}
                  />
                  <span style={{ 
                    color: value ? '#3ABC96' : '#E36756',
                    fontSize: 12
                  }}>
                    {value ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </label>
              ) : Array.isArray(value) ? (
                <div style={{ 
                  flex: 1,
                  backgroundColor: key === 'custom_instructions' 
                    ? 'rgba(52, 152, 219, 0.05)' 
                    : key === 'exclude_by_default'
                    ? 'rgba(231, 76, 60, 0.05)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: key === 'custom_instructions'
                    ? '1px solid rgba(52, 152, 219, 0.2)'
                    : key === 'exclude_by_default'
                    ? '1px solid rgba(231, 76, 60, 0.2)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 4
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10
                  }}>
                    <div style={{ 
                      fontSize: 11,
                      fontWeight: 600,
                      color: key === 'custom_instructions'
                        ? '#3498db'
                        : key === 'exclude_by_default'
                        ? '#e74c3c'
                        : '#3ABC96',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}>
                      {key === 'custom_instructions' 
                        ? '📝 CUSTOM INSTRUCTIONS' 
                        : key === 'exclude_by_default'
                        ? '🚫 EXCLUSIONS'
                        : `📋 ${key.replace(/_/g, ' ').toUpperCase()}`}
                      <span style={{ 
                        marginLeft: 8,
                        fontSize: 10,
                        opacity: 0.7,
                        fontWeight: 400
                      }}>
                        ({value.length} items)
                      </span>
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 8,
                    marginBottom: 10,
                    minHeight: 28
                  }}>
                    {value.length === 0 ? (
                      <span style={{ 
                        color: '#666', 
                        fontSize: 11, 
                        fontStyle: 'italic',
                        padding: '4px 0'
                      }}>
                        No items added yet
                      </span>
                    ) : (
                      value.map((item, index) => (
                        <div key={index} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: key === 'custom_instructions' ? '6px 10px' : '4px 10px',
                          backgroundColor: key === 'custom_instructions'
                            ? 'rgba(52, 152, 219, 0.15)'
                            : key === 'exclude_by_default'
                            ? 'rgba(231, 76, 60, 0.15)'
                            : 'rgba(58, 188, 150, 0.15)',
                          border: key === 'custom_instructions'
                            ? '1px solid rgba(52, 152, 219, 0.3)'
                            : key === 'exclude_by_default'
                            ? '1px solid rgba(231, 76, 60, 0.3)'
                            : '1px solid rgba(58, 188, 150, 0.3)',
                          borderRadius: key === 'custom_instructions' ? 6 : 14,
                          fontSize: key === 'custom_instructions' ? 11 : 11,
                          maxWidth: key === 'custom_instructions' ? '100%' : 'auto'
                        }}>
                          <span style={{ 
                            color: '#fff',
                            lineHeight: key === 'custom_instructions' ? 1.4 : 1
                          }}>
                            {typeof item === 'string' 
                              ? (key === 'custom_instructions' ? item : item.replace(/_/g, ' '))
                              : item}
                          </span>
                          {!isReadOnly && (
                            <button
                              onClick={() => removeArrayItem(currentPath, index)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: key === 'exclude_by_default' 
                                  ? '#e74c3c'
                                  : '#999',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: 16,
                                lineHeight: 1,
                                opacity: 0.8,
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {!isReadOnly && (
                    showAddArrayItem === currentPath.join('.') ? (
                      <div style={{ 
                        display: 'flex', 
                        gap: 6,
                        padding: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <input
                          type="text"
                          value={newArrayItem}
                          onChange={(e) => setNewArrayItem(e.target.value)}
                          placeholder={
                            key === 'custom_instructions' 
                              ? "Enter instruction..." 
                              : key === 'exclude_by_default'
                              ? "Enter exclusion term..."
                              : "Enter item..."
                          }
                          style={{
                            flex: 1,
                            padding: '5px 10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: key === 'custom_instructions'
                              ? '1px solid rgba(52, 152, 219, 0.4)'
                              : key === 'exclude_by_default'
                              ? '1px solid rgba(231, 76, 60, 0.4)'
                              : '1px solid rgba(58, 188, 150, 0.4)',
                            borderRadius: 4,
                            color: '#fff',
                            fontSize: 11,
                            minWidth: key === 'custom_instructions' ? 300 : 150
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') addArrayItem(currentPath, newArrayItem)
                            if (e.key === 'Escape') { setShowAddArrayItem(null); setNewArrayItem(''); }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => addArrayItem(currentPath, newArrayItem)}
                          disabled={!newArrayItem.trim()}
                          style={{
                            padding: '5px 12px',
                            backgroundColor: newArrayItem.trim() ? '#27ae60' : 'rgba(39, 174, 96, 0.3)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: newArrayItem.trim() ? 'pointer' : 'not-allowed',
                            fontSize: 11,
                            fontWeight: 500
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowAddArrayItem(null); setNewArrayItem(''); }}
                          style={{
                            padding: '5px 12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 11
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddArrayItem(currentPath.join('.'))}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: key === 'custom_instructions'
                            ? 'rgba(52, 152, 219, 0.2)'
                            : key === 'exclude_by_default'
                            ? 'rgba(231, 76, 60, 0.2)'
                            : 'rgba(58, 188, 150, 0.2)',
                          color: key === 'custom_instructions'
                            ? '#3498db'
                            : key === 'exclude_by_default'
                            ? '#e74c3c'
                            : '#3ABC96',
                          border: key === 'custom_instructions'
                            ? '1px solid rgba(52, 152, 219, 0.3)'
                            : key === 'exclude_by_default'
                            ? '1px solid rgba(231, 76, 60, 0.3)'
                            : '1px solid rgba(58, 188, 150, 0.3)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 10,
                          fontWeight: 500
                        }}
                      >
                        + Add {key === 'exclude_by_default' ? 'Exclusion' : key === 'custom_instructions' ? 'Instruction' : 'Item'}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={String(value).replace(/_/g, ' ')}
                  onChange={(e) => handleLogicChange(currentPath, e.target.value)}
                  disabled={isReadOnly}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 150
                  }}
                />
              )}
            </div>
          )}
        </div>
      )
    }).filter(Boolean)
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '90vw',
        maxWidth: 1200,
        height: '90vh',
        backgroundColor: 'rgb(40, 44, 52)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>
                Enhanced Logic Editor
              </h2>
              <input
                list="logic-study-types"
                value={selectedStudyType}
                onChange={(e) => setSelectedStudyType(e.target.value)}
                placeholder="Select study type..."
                style={{
                  marginTop: 8,
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  width: 250
                }}
              />
              <datalist id="logic-study-types">
                {Object.keys(templates).sort().map(type => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
            <button
              onClick={() => {
                // Ensure focus is restored before closing
                const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
                if (editor) {
                  editor.focus();
                }
                onClose();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>

          {/* Mode Selector */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setEditMode('base')}
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'base' ? '#3498db' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Edit Base Logic
              {lastUpdated.base && (
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 8 }}>
                  (Updated: {new Date(lastUpdated.base).toLocaleDateString()})
                </span>
              )}
            </button>
            <button
              onClick={() => setEditMode('study')}
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'study' ? '#9b59b6' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Edit Study-Specific Logic
              {lastUpdated.study && (
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 8 }}>
                  (Updated: {new Date(lastUpdated.study).toLocaleDateString()})
                </span>
              )}
            </button>
            <button
              onClick={() => setEditMode('preview')}
              style={{
                padding: '8px 16px',
                backgroundColor: editMode === 'preview' ? '#27ae60' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Preview Merged Logic
            </button>
            {editMode === 'study' && studyLogic && Object.keys(studyLogic).length > 0 && (
              <button
                onClick={() => setShowDiffView(!showDiffView)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: showDiffView ? '#e67e22' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                {showDiffView ? 'Hide Diff' : 'Show Diff'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={userTier >= 4 ? () => setShowPromptPreview(true) : undefined}
              disabled={userTier < 4}
              title={userTier < 4 ? 'Requires Developer tier' : 'Preview AI Prompt'}
              style={{
                padding: '8px 16px',
                backgroundColor: userTier < 4 ? '#666' : '#8e44ad',
                color: userTier < 4 ? '#999' : '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: userTier < 4 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: userTier < 4 ? 0.6 : 1
              }}
            >
              <span style={{ fontSize: 16 }}>{userTier < 4 ? '🔒' : '🤖'}</span>
              Preview AI Prompt {userTier < 4 && '(Dev Only)'}
            </button>
          </div>
        </div>

        {/* Mode Description */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: editMode === 'base' ? 'rgba(52, 152, 219, 0.1)' : 
                           editMode === 'study' ? 'rgba(155, 89, 182, 0.1)' : 
                           'rgba(39, 174, 96, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <p style={{ color: '#ccc', fontSize: 13, margin: 0 }}>
            {editMode === 'base' && "Base logic applies to ALL study types. Changes here affect all templates."}
            {editMode === 'study' && `Study-specific logic for ${selectedStudyType}. Overrides base logic settings.`}
            {editMode === 'preview' && "Preview shows the final merged logic that will be used for report generation."}
          </p>
          {showDiffView && editMode === 'study' && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ color: '#e67e22', fontSize: 12 }}>Differences from base:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 11, color: '#aaa' }}>
                {getLogicDiffSummary(baseLogic || getDefaultAgentLogic(), studyLogic).map((diff, i) => (
                  <li key={i}>{diff}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Logic Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          {editMode !== 'preview' && (
            <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAddSection(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27ae60',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                + Add Section
              </button>
              <button
                onClick={() => setShowAddInstruction(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3498db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                + Add Custom Instruction
              </button>
            </div>
          )}
          
          {showAddSection && (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 8
            }}>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Enter section name..."
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 4,
                  marginRight: 8,
                  width: 250
                }}
                onKeyPress={(e) => e.key === 'Enter' && addSection()}
              />
              <button
                onClick={addSection}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#27ae60',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  marginRight: 8
                }}
              >
                Add Section
              </button>
              <button
                onClick={() => { setShowAddSection(false); setNewSectionName(''); }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          )}
          
          {showAddInstruction && (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              backgroundColor: 'rgba(52, 152, 219, 0.05)',
              borderRadius: 8,
              border: '1px solid rgba(52, 152, 219, 0.2)'
            }}>
              <h5 style={{ color: '#3498db', fontSize: 13, marginBottom: 10, fontWeight: 500 }}>
                Add a New Custom Instruction
              </h5>
              <p style={{ color: '#aaa', fontSize: 11, marginBottom: 12 }}>
                Enter a single, specific instruction for the AI to follow when generating reports.
              </p>
              <textarea
                value={newInstruction}
                onChange={(e) => setNewInstruction(e.target.value)}
                placeholder="Example: Always mention comparison to prior studies if available..."
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: '1px solid rgba(52, 152, 219, 0.3)',
                  borderRadius: 4,
                  marginBottom: 12,
                  width: '100%',
                  minHeight: 80,
                  resize: 'vertical',
                  fontSize: 12,
                  fontFamily: 'inherit'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    addCustomInstruction()
                  } else if (e.key === 'Escape') {
                    setShowAddInstruction(false)
                    setNewInstruction('')
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: 10 }}>
                  Tip: Press Ctrl+Enter to add, Esc to cancel
                </span>
                <div>
                  <button
                    onClick={addCustomInstruction}
                    disabled={!newInstruction.trim()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: newInstruction.trim() ? '#3498db' : 'rgba(52, 152, 219, 0.3)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: newInstruction.trim() ? 'pointer' : 'not-allowed',
                      marginRight: 8,
                      fontSize: 13
                    }}
                  >
                    Add Instruction
                  </button>
                  <button
                    onClick={() => { setShowAddInstruction(false); setNewInstruction(''); }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {displayLogic?.custom_instructions && displayLogic.custom_instructions.length > 0 && (
            <div style={{ 
              marginBottom: 20,
              padding: 16,
              backgroundColor: 'rgba(58, 188, 150, 0.05)',
              borderRadius: 8,
              border: '1px solid rgba(58, 188, 150, 0.2)'
            }}>
              <h4 style={{ 
                color: '#3ABC96', 
                fontSize: 14, 
                marginBottom: 12,
                fontWeight: 600
              }}>
                Custom Instructions ({displayLogic.custom_instructions.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayLogic.custom_instructions.map((instruction: string, index: number) => (
                  <div key={index} style={{ 
                    padding: 12, 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 6,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}>
                    <div style={{ 
                      minWidth: 24,
                      height: 24,
                      backgroundColor: 'rgba(58, 188, 150, 0.2)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#3ABC96',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    
                    {editingInstruction?.index === index ? (
                      <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                        <textarea
                          value={editingInstruction.value}
                          onChange={(e) => setEditingInstruction({ index, value: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: '#fff',
                            border: '1px solid rgba(58, 188, 150, 0.4)',
                            borderRadius: 4,
                            fontSize: 12,
                            minHeight: 60,
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingInstruction(null)
                            } else if (e.key === 'Enter' && e.ctrlKey) {
                              updateCustomInstruction(index, editingInstruction.value)
                            }
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button
                            onClick={() => updateCustomInstruction(index, editingInstruction.value)}
                            style={{
                              padding: '4px 8px',
                              fontSize: 10,
                              backgroundColor: '#27ae60',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingInstruction(null)}
                            style={{
                              padding: '4px 8px',
                              fontSize: 10,
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 3,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ 
                          flex: 1,
                          color: '#fff', 
                          fontSize: 12,
                          lineHeight: 1.5,
                          wordBreak: 'break-word'
                        }}>
                          {instruction}
                        </div>
                        
                        {editMode !== 'preview' && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button
                              onClick={() => setEditingInstruction({ index, value: instruction })}
                              style={{
                                padding: '4px 8px',
                                fontSize: 10,
                                backgroundColor: '#3498db',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 3,
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeCustomInstruction(index)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 10,
                                backgroundColor: '#e74c3c',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 3,
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div style={{ color: '#ccc', textAlign: 'center', padding: 40 }}>
              Loading logic configuration...
            </div>
          ) : displayLogic ? (
            renderLogicSection(displayLogic, [], editMode === 'preview')
          ) : (
            <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>
              {editMode === 'study' ? 'No study-specific overrides defined. Using base logic.' : 'No logic loaded'}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {editMode !== 'preview' && (
              <>
                <button
                  onClick={savePendingChanges}
                  disabled={!pendingChanges || isLoading}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: pendingChanges ? '#27ae60' : 'rgba(255, 255, 255, 0.05)',
                    color: pendingChanges ? '#fff' : '#888',
                    border: 'none',
                    borderRadius: 6,
                    cursor: pendingChanges ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: 'rgba(231, 76, 60, 0.8)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                >
                  Reset to Default
                </button>
              </>
            )}
          </div>
          {isOfflineMode && (
            <span style={{ color: '#f39c12', fontSize: 12 }}>
              ⚠ Offline Mode - Changes saved locally
            </span>
          )}
        </div>

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgb(40, 44, 52)',
            padding: 20,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 10001
          }}>
            <p style={{ color: '#fff', marginBottom: 16 }}>
              Are you sure you want to delete this {deleteConfirm.type}?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteItem}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Reset Confirmation */}
        {showResetConfirm && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgb(40, 44, 52)',
            padding: 20,
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 10001
          }}>
            <p style={{ color: '#fff', marginBottom: 16 }}>
              Reset {editMode === 'base' ? 'base' : 'study-specific'} logic to default?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            padding: '12px 20px',
            backgroundColor: toastMessage.type === 'success' ? '#27ae60' : '#e74c3c',
            color: '#fff',
            borderRadius: 6,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            fontSize: 14
          }}>
            {toastMessage.text}
          </div>
        )}

        {/* AI Prompt Preview Modal */}
        {showPromptPreview && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002
          }}>
            <div style={{
              width: '80%',
              maxWidth: 900,
              height: '80%',
              backgroundColor: 'rgb(30, 30, 35)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Preview Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(142, 68, 173, 0.1)',
                borderRadius: '12px 12px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🤖</span>
                  <h3 style={{ 
                    color: '#fff', 
                    margin: 0, 
                    fontSize: 16, 
                    fontWeight: 600 
                  }}>
                    AI Prompt Preview
                  </h3>
                  <span style={{ 
                    color: '#aaa', 
                    fontSize: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {editMode === 'base' ? 'Base Logic' : editMode === 'study' ? `Study: ${selectedStudyType}` : 'Merged'}
                  </span>
                </div>
                <button
                  onClick={() => setShowPromptPreview(false)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Close
                </button>
              </div>

              {/* Preview Content */}
              <div style={{
                flex: 1,
                padding: 20,
                overflowY: 'auto',
                backgroundColor: 'rgba(0, 0, 0, 0.3)'
              }}>
                <pre style={{
                  margin: 0,
                  padding: 16,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(142, 68, 173, 0.3)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {generatePromptPreview()}
                </pre>
              </div>

              {/* Preview Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ 
                  color: '#888', 
                  fontSize: 11 
                }}>
                  This preview shows how your logic settings will be translated into AI instructions
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatePromptPreview())
                    showToast('success', 'Prompt copied to clipboard!')
                  }}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: '#8e44ad',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}