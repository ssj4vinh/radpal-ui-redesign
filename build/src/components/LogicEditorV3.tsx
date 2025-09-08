import React, { useState, useEffect } from 'react'
import { 
  fetchAgentLogicV2, 
  updateBaseLogicV2, 
  updateStudyLogicV2, 
  resetLogicV2
} from '../supabase/agentLogicQueriesIPCV2'
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
  
  // State for input modal
  const [inputModal, setInputModal] = useState<{ 
    show: boolean, 
    path: string[], 
    label: string,
    value: string 
  }>({ show: false, path: [], label: '', value: '' })

  useEffect(() => {
    loadAvailableStudyTypes()
  }, [userId])

  useEffect(() => {
    if (selectedStudyType) {
      loadLogic()
    }
  }, [selectedStudyType, userId])

  useEffect(() => {
    switch (editMode) {
      case 'base':
        setDisplayLogic(baseLogic || getDefaultStandardizedLogic())
        break
      case 'study':
        // Ensure study logic has all required structure
        const studyLogicWithDefaults = studyLogic || getDefaultStudySpecificLogic()
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
        setDisplayLogic(mergedLogic || getDefaultStandardizedLogic())
        break
    }
  }, [editMode, baseLogic, studyLogic, mergedLogic])

  const loadAvailableStudyTypes = async () => {
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

  const loadLogic = async () => {
    setIsLoading(true)
    try {
      const result = await fetchAgentLogicV2(userId, selectedStudyType, isOfflineMode)
      if (result.success) {
        setBaseLogic(result.baseLogic || getDefaultStandardizedLogic())
        
        // For study logic, deep merge with defaults to ensure all properties exist
        const defaultStudyLogic = getDefaultStudySpecificLogic()
        const loadedStudyLogic = result.studyLogic || {}
        
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
        
        // Store legacy logic if available
        if (result.legacyLogic) {
          setLegacyLogic(result.legacyLogic)
        }
        
        // Merged logic combines base + study
        const merged = {
          ...getDefaultStandardizedLogic(),
          ...(result.baseLogic || {}),
          ...mergedStudyLogic
        }
        setMergedLogic(merged)
      }
    } catch (error) {
      console.error('Error loading logic:', error)
      showToast('error', 'Failed to load logic')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!displayLogic) return
    
    setIsLoading(true)
    try {
      let result
      if (editMode === 'base') {
        result = await updateBaseLogicV2(userId, displayLogic, isOfflineMode)
      } else if (editMode === 'study') {
        result = await updateStudyLogicV2(userId, selectedStudyType, displayLogic, isOfflineMode)
      }
      
      if (result?.success) {
        showToast('success', 'Logic saved successfully')
        await loadLogic()
      } else {
        throw new Error(result?.error || 'Save failed')
      }
    } catch (error) {
      console.error('Error saving logic:', error)
      showToast('error', 'Failed to save logic')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
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

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const generateBasePrompt = () => {
    // This is the raw prompt without any logic customizations
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
    
    prompt += 'CRITICAL: You must incorporate ALL findings provided above into the appropriate sections.'
    
    return prompt
  }

  const generatePromptPreview = () => {
    const logic = mergedLogic || displayLogic || getDefaultStandardizedLogic()
    
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
    
    const instructions: string[] = []
    
    // GENERAL Category
    if (logic.general) {
      // Corrections (no toggle, always active if rules exist)
      if (logic.general.corrections?.rules?.length > 0) {
        for (const rule of logic.general.corrections.rules) {
          if (rule.find && rule.replace) {
            instructions.push(`Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`)
          }
        }
      }
      
      if (logic.general.tone?.style) {
        switch (logic.general.tone.style) {
          case 'definitive':
            instructions.push('Use definitive language (e.g., "demonstrates", "shows", "is")')
            break
          case 'cautious':
            instructions.push('Use cautious language (e.g., "suggests", "likely", "appears to be")')
            break
          case 'balanced':
            instructions.push('Use balanced language, mixing definitive and cautious terms appropriately')
            break
        }
      }
      
      // Disallowed Symbols
      if (logic.general.disallowed_symbols?.enabled !== false && logic.general.disallowed_symbols?.symbols?.length > 0) {
        instructions.push(`NEVER use these formatting symbols: ${logic.general.disallowed_symbols.symbols.join(', ')}`)
      }
      
      // Disallowed Items (individual toggles)
      const disallowedItemsList: string[] = []
      if (logic.general.disallowed_items) {
        if (logic.general.disallowed_items.patient_identifiers !== false) {
          disallowedItemsList.push('patient identifiers')
        }
        if (logic.general.disallowed_items.names !== false) {
          disallowedItemsList.push('names')
        }
        if (logic.general.disallowed_items.radiology_report_title !== false) {
          disallowedItemsList.push('radiology report title')
        }
        if (logic.general.disallowed_items.referring_physician !== false) {
          disallowedItemsList.push('referring physician')
        }
        if (logic.general.disallowed_items.radiologist_signature !== false) {
          disallowedItemsList.push('radiologist signature')
        }
        if (logic.general.disallowed_items.credentials !== false) {
          disallowedItemsList.push('credentials')
        }
        if (logic.general.disallowed_items.date !== false) {
          disallowedItemsList.push('date')
        }
      }
      if (disallowedItemsList.length > 0) {
        instructions.push(`Do not include: ${disallowedItemsList.join(', ')}`)
      }
    }
    
    // REPORT Category
    if (logic.report) {
      if (logic.report.formatting) {
        if (logic.report.formatting.use_bullet_points) {
          instructions.push('Use bullet points for listing findings within sections')
        }
        if (logic.report.formatting.preserve_template_punctuation) {
          instructions.push('Preserve all punctuation and formatting exactly as shown in the template')
        }
        if (logic.report.formatting.prevent_unnecessary_capitalization) {
          instructions.push('Avoid unnecessary capitalization except for section headers')
        }
      }
      
      if (logic.report.language?.expand_lesion_descriptions) {
        instructions.push('Expand lesion descriptions to include location, size, morphology, and characteristics')
      }
    }
    
    // IMPRESSION Category
    if (logic.impression) {
      if (logic.impression.format) {
        switch (logic.impression.format.style) {
          case 'numerically_itemized':
            instructions.push('IMPRESSION FORMAT: Use numbered list (1, 2, 3, etc.)')
            break
          case 'bullet_points':
            instructions.push('IMPRESSION FORMAT: Use bullet points (• ) for each item')
            break
          case 'none':
            instructions.push('IMPRESSION FORMAT: Write as continuous prose without bullets or numbers')
            break
        }
        
        if (logic.impression.format.spacing === 'double') {
          instructions.push('Use double spacing between impression items')
        } else {
          instructions.push('Use single spacing between impression items')
        }
      }
      
      if (logic.impression.exclude_by_default && logic.impression.exclude_by_default.length > 0) {
        const readableExclusions = logic.impression.exclude_by_default.map(item => 
          item.replace(/_/g, ' ').toLowerCase()
        )
        instructions.push(`Do not include these in the impression unless clinically significant: ${readableExclusions.join(', ')}`)
      }
    }
    
    // STUDY-SPECIFIC REPORT Category
    if (logic.study_report) {
      if (logic.study_report.anatomic_routing_rules && logic.study_report.anatomic_routing_rules.length > 0) {
        instructions.push('=== ANATOMIC ROUTING RULES ===')
        for (const rule of logic.study_report.anatomic_routing_rules) {
          if (rule.condition && rule.route_to) {
            instructions.push(`If finding contains "${rule.condition}", route to "${rule.route_to}" section`)
          }
        }
      }
      
      if (logic.study_report.custom_rules && logic.study_report.custom_rules.length > 0) {
        instructions.push('=== STUDY REPORT CUSTOM RULES ===')
        instructions.push(...logic.study_report.custom_rules)
      }
    }
    
    // STUDY-SPECIFIC IMPRESSION Category
    if (logic.study_impression) {
      if (logic.study_impression.required_opening_phrase?.enabled && logic.study_impression.required_opening_phrase.phrase) {
        instructions.push(`REQUIRED: Start the impression with: "${logic.study_impression.required_opening_phrase.phrase}"`)
      }
      
      // Priority settings
      if (logic.study_impression.priority) {
        const priority = logic.study_impression.priority
        const hasPriorities = (priority.high_priority_findings?.length || 0) + 
                             (priority.high_priority_keywords?.length || 0) +
                             (priority.mid_priority_findings?.length || 0) + 
                             (priority.mid_priority_keywords?.length || 0) +
                             (priority.low_priority_findings?.length || 0) + 
                             (priority.low_priority_keywords?.length || 0) > 0
        
        if (hasPriorities) {
          instructions.push('=== IMPRESSION PRIORITY RULES ===')
          
          if (priority.high_priority_findings?.length || priority.high_priority_keywords?.length) {
            instructions.push('HIGH PRIORITY (list first):')
            if (priority.high_priority_findings?.length) {
              instructions.push(`  Findings: ${priority.high_priority_findings.join(', ')}`)
            }
            if (priority.high_priority_keywords?.length) {
              instructions.push(`  Keywords: ${priority.high_priority_keywords.join(', ')}`)
            }
          }
          
          if (priority.mid_priority_findings?.length || priority.mid_priority_keywords?.length) {
            instructions.push('MID PRIORITY (list after high priority):')
            if (priority.mid_priority_findings?.length) {
              instructions.push(`  Findings: ${priority.mid_priority_findings.join(', ')}`)
            }
            if (priority.mid_priority_keywords?.length) {
              instructions.push(`  Keywords: ${priority.mid_priority_keywords.join(', ')}`)
            }
          }
          
          if (priority.low_priority_findings?.length || priority.low_priority_keywords?.length) {
            instructions.push('LOW PRIORITY (list last):')
            if (priority.low_priority_findings?.length) {
              instructions.push(`  Findings: ${priority.low_priority_findings.join(', ')}`)
            }
            if (priority.low_priority_keywords?.length) {
              instructions.push(`  Keywords: ${priority.low_priority_keywords.join(', ')}`)
            }
          }
        }
      }
      
      // Grouping strategy
      if (logic.study_impression.grouping_strategy) {
        switch (logic.study_impression.grouping_strategy) {
          case 'severity':
            instructions.push('Group impression items by severity (most to least severe)')
            break
          case 'anatomic_region':
            instructions.push('Group impression items by anatomic region (e.g., lateral → medial → central)')
            break
          case 'clinical_relevance':
            instructions.push('Group impression items by clinical relevance based on keywords')
            break
        }
      }
      
      // Auto-reordering
      if (logic.study_impression.auto_reordering === false) {
        instructions.push('IMPORTANT: Preserve the order of user-entered findings - do NOT reorder')
      } else {
        instructions.push('Intelligently reorder findings based on severity and clinical importance')
      }
      
      // Study-specific exclusions
      if (logic.study_impression.exclude_by_default && logic.study_impression.exclude_by_default.length > 0) {
        instructions.push(`Study-specific exclusions: Do not include ${logic.study_impression.exclude_by_default.join(', ')} unless critical`)
      }
      
      // Custom impression rules
      if (logic.study_impression.custom_rules && logic.study_impression.custom_rules.length > 0) {
        instructions.push('=== STUDY IMPRESSION CUSTOM RULES ===')
        instructions.push(...logic.study_impression.custom_rules)
      }
    }
    
    // Custom instructions
    if (logic.custom_instructions && logic.custom_instructions.length > 0) {
      instructions.push('=== CUSTOM INSTRUCTIONS ===')
      instructions.push(...logic.custom_instructions)
    }
    
    // Build final prompt
    if (instructions.length > 0) {
      prompt += 'INSTRUCTIONS:\n'
      instructions.forEach((instruction, index) => {
        prompt += `${index + 1}. ${instruction}\n`
      })
    }
    
    prompt += '\nCRITICAL: You must incorporate ALL findings provided above into the appropriate sections.'
    
    return prompt
  }

  const updateLogicValue = (path: string[], value: any) => {
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

  const renderArrayInput = (path: string[], defaultItems: string[], label: string) => {
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
                <span style={{ flex: 1, color: '#fff', fontSize: 13 }}>{item}</span>
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
              padding: '6px 12px',
              backgroundColor: '#3ABC96',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            + Add Item
          </button>
        )}
      </div>
    )
  }

  const renderV3Logic = () => {
    if (!displayLogic) return null

    return (
      <div style={{ padding: 20 }}>
        {/* GENERAL Category */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>GENERAL</h3>
          
          {/* Corrections */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Corrections</h4>
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

          {/* Tone */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Tone</h4>
            <select
              value={displayLogic.general?.tone?.style || 'balanced'}
              onChange={(e) => updateLogicValue(['general', 'tone', 'style'], e.target.value)}
              disabled={editMode === 'preview'}
              style={{
                padding: '6px 10px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 4,
                color: '#fff'
              }}
            >
              <option value="definitive">Definitive</option>
              <option value="cautious">Cautious</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>

          {/* Allowed Sections */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Allowed Sections</h4>
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

          {/* Disallowed Symbols */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Disallowed Symbols</h4>
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

          {/* Disallowed Items */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Disallowed Items</h4>
            <div style={{ marginLeft: 10 }}>
              {renderToggle(['general', 'disallowed_items', 'patient_identifiers'], 
                displayLogic.general?.disallowed_items?.patient_identifiers !== false, 
                'Patient identifiers')}
              {renderToggle(['general', 'disallowed_items', 'names'], 
                displayLogic.general?.disallowed_items?.names !== false, 
                'Names')}
              {renderToggle(['general', 'disallowed_items', 'radiology_report_title'], 
                displayLogic.general?.disallowed_items?.radiology_report_title !== false, 
                'Radiology report title')}
              {renderToggle(['general', 'disallowed_items', 'referring_physician'], 
                displayLogic.general?.disallowed_items?.referring_physician !== false, 
                'Referring physician')}
              {renderToggle(['general', 'disallowed_items', 'radiologist_signature'], 
                displayLogic.general?.disallowed_items?.radiologist_signature !== false, 
                'Radiologist signature')}
              {renderToggle(['general', 'disallowed_items', 'credentials'], 
                displayLogic.general?.disallowed_items?.credentials !== false, 
                'Credentials')}
              {renderToggle(['general', 'disallowed_items', 'date'], 
                displayLogic.general?.disallowed_items?.date !== false, 
                'Date')}
            </div>
          </div>
        </div>

        {/* REPORT Category */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>REPORT</h3>
          
          {/* Formatting */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Formatting</h4>
            {renderToggle(['report', 'formatting', 'use_bullet_points'], 
              displayLogic.report?.formatting?.use_bullet_points || false, 
              'Use bullet points')}
            {renderToggle(['report', 'formatting', 'preserve_template_punctuation'], 
              displayLogic.report?.formatting?.preserve_template_punctuation || false, 
              'Preserve template punctuation')}
            {renderToggle(['report', 'formatting', 'prevent_unnecessary_capitalization'], 
              displayLogic.report?.formatting?.prevent_unnecessary_capitalization || false, 
              'Prevent unnecessary capitalization')}
          </div>

          {/* Language */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Language</h4>
            {renderToggle(['report', 'language', 'expand_lesion_descriptions'], 
              displayLogic.report?.language?.expand_lesion_descriptions || false, 
              'Expand lesion descriptions')}
          </div>
        </div>

        {/* IMPRESSION Category */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>IMPRESSION</h3>
          
          {/* Format */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Format</h4>
            <div style={{ marginBottom: 10 }}>
              <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
                Style
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
                Spacing
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

          {/* Exclude by Default */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Exclude by Default</h4>
            {renderArrayInput(['impression', 'exclude_by_default'], 
              [], 
              'Items to exclude (one per line)')}
          </div>
        </div>

        {/* Custom Instructions */}
        {displayLogic.custom_instructions && (
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>CUSTOM INSTRUCTIONS</h3>
            <div style={{ marginLeft: 20 }}>
              {renderArrayInput(['custom_instructions'], 
                [], 
                'Additional instructions (one per line)')}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderStudySpecificLogic = () => {
    if (!displayLogic) return null

    return (
      <div style={{ padding: 20 }}>
        {/* STUDY REPORT Category */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>STUDY REPORT</h3>
          
          {/* Anatomic Routing Rules */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Anatomic Routing Rules</h4>
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

          {/* Custom Rules */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Custom Rules</h4>
            {renderArrayInput(['study_report', 'custom_rules'], 
              [], 
              'Custom report rules (one per line)')}
          </div>
        </div>

        {/* STUDY IMPRESSION Category */}
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#3ABC96', marginBottom: 15 }}>STUDY IMPRESSION</h3>
          
          {/* Required Opening Phrase */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Required Opening Phrase</h4>
            <div style={{ marginBottom: 10 }}>
              {renderToggle(['study_impression', 'required_opening_phrase', 'enabled'], 
                displayLogic.study_impression?.required_opening_phrase?.enabled || false, 
                'Enable required opening phrase')}
            </div>
            {displayLogic.study_impression?.required_opening_phrase?.enabled && (
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
                  fontSize: 13
                }}
              />
            )}
          </div>

          {/* Priority Settings */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Priority Settings</h4>
            
            <div style={{ marginBottom: 15 }}>
              <h5 style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>HIGH PRIORITY</h5>
              {renderArrayInput(['study_impression', 'priority', 'high_priority_findings'], 
                [], 
                'High priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'high_priority_keywords'], 
                [], 
                'High priority keywords (one per line)')}
            </div>

            <div style={{ marginBottom: 15 }}>
              <h5 style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>MID PRIORITY</h5>
              {renderArrayInput(['study_impression', 'priority', 'mid_priority_findings'], 
                [], 
                'Mid priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'mid_priority_keywords'], 
                [], 
                'Mid priority keywords (one per line)')}
            </div>

            <div style={{ marginBottom: 15 }}>
              <h5 style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>LOW PRIORITY</h5>
              {renderArrayInput(['study_impression', 'priority', 'low_priority_findings'], 
                [], 
                'Low priority findings (one per line)')}
              {renderArrayInput(['study_impression', 'priority', 'low_priority_keywords'], 
                [], 
                'Low priority keywords (one per line)')}
            </div>
          </div>

          {/* Grouping Strategy */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Grouping Strategy</h4>
            <select
              value={displayLogic.study_impression?.grouping_strategy || 'severity'}
              onChange={(e) => updateLogicValue(['study_impression', 'grouping_strategy'], e.target.value)}
              disabled={editMode === 'preview'}
              style={{
                padding: '6px 10px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #3a3a3a',
                borderRadius: 4,
                color: '#fff'
              }}
            >
              <option value="severity">By Severity (default)</option>
              <option value="anatomic_region">By Anatomic Region</option>
              <option value="clinical_relevance">By Clinical Relevance</option>
            </select>
          </div>

          {/* Auto-reordering */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Auto-reordering</h4>
            {renderToggle(['study_impression', 'auto_reordering'], 
              displayLogic.study_impression?.auto_reordering !== false, 
              'Intelligently reorder based on severity rules')}
          </div>

          {/* Exclude by Default */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Exclude by Default</h4>
            {renderArrayInput(['study_impression', 'exclude_by_default'], 
              [], 
              'Items to exclude from impression (one per line)')}
          </div>

          {/* Custom Rules */}
          <div style={{ marginLeft: 20, marginBottom: 20 }}>
            <h4 style={{ color: '#aaa', marginBottom: 10 }}>Custom Rules</h4>
            {renderArrayInput(['study_impression', 'custom_rules'], 
              [], 
              'Custom impression rules (one per line)')}
          </div>
        </div>
      </div>
    )
  }

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
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        width: '90%',
        maxWidth: 900,
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
          <h2 style={{ color: '#fff', margin: 0 }}>
            Logic Editor (v3.0) {editMode === 'study' && selectedStudyType ? `- ${selectedStudyType}` : ''}
          </h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Preview buttons - Only for tier 4 users (developer edition) */}
            {userTier === 4 && (
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
                  title="Preview the base prompt without customizations"
                >
                  Preview Base Prompt
                </button>
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
                    Base Prompt Preview
                  </h3>
                  <small style={{ color: '#888', fontSize: 12 }}>
                    This is the minimal prompt without any logic customizations
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
      </div>
    </div>
  )
}