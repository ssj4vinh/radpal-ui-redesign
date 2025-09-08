import React, { useState, useEffect } from 'react'
import { updateAgentLogicWithOffline, resetAgentLogicToDefaultWithOffline, getCurrentAgentLogicWithOffline } from '../supabase/updateAgentLogicWithOffline'
import { getDefaultAgentLogic } from '../utils/logicMerge'

interface LogicEditorDirectProps {
  userId: string
  studyType: string
  templates?: Record<string, any>
  onClose: () => void
  isOfflineMode?: boolean
}

export default function LogicEditorDirect({ userId, studyType, templates = {}, onClose, isOfflineMode = false }: LogicEditorDirectProps) {
  // If no study type provided, default to the first available or "MRI Knee" if it exists
  const availableStudyTypes = Object.keys(templates || {}).sort()
  const defaultStudyType = studyType || 
    (availableStudyTypes.includes('MRI Knee') ? 'MRI Knee' : availableStudyTypes[0] || '')
  

  // Get default logic structure to identify custom properties
  const defaultLogic = getDefaultAgentLogic()
  
  // Check if a property is deletable (all properties except version are deletable)
  const isPropertyDeletable = (section: string, property: string): boolean => {
    // Version is never deletable
    if (section === 'root' && property === 'version') return false
    // All other properties are deletable
    return true
  }
  
  // Check if a section is deletable (all sections except core ones)
  const isSectionDeletable = (section: string): boolean => {
    const coreSections = ['version']
    return !coreSections.includes(section)
  }

  // Render a dynamic section with add/delete capabilities
  const renderDynamicSection = (sectionName: string, sectionTitle: string, icon: string) => {
    const sectionKey = sectionName.toLowerCase().replace(/\s+/g, '_')
    
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: '#3ABC96', margin: 0 }}>{icon} {sectionTitle}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowQuickAdd(showQuickAdd === sectionKey ? null : sectionKey)}
              style={{
                background: 'rgba(58, 188, 150, 0.2)',
                border: '1px solid rgba(58, 188, 150, 0.3)',
                borderRadius: 4,
                color: '#3ABC96',
                fontSize: 11,
                cursor: 'pointer',
                padding: '3px 8px',
                fontWeight: 500
              }}
              title={`Add property to ${sectionTitle}`}
            >
              + Add Property
            </button>
            {isSectionDeletable(sectionKey) && (
              <button
                onClick={() => {
                  const confirmed = window.confirm(
                    `Are you sure you want to delete the entire "${sectionTitle}" section?\n\nThis will remove all properties in this section and cannot be undone.`
                  )
                  if (confirmed) {
                    setCurrentLogic(prev => {
                      const updated = JSON.parse(JSON.stringify(prev))
                      delete updated[sectionKey]
                      return updated
                    })
                    setPendingChanges(prev => {
                      const updated = JSON.parse(JSON.stringify(prev || {}))
                      updated[sectionKey] = undefined // Mark section for deletion
                      return updated
                    })
                    showToast('success', `${sectionTitle} section deleted`)
                  }
                }}
                style={{
                  background: 'rgba(227, 103, 86, 0.2)',
                  border: '1px solid rgba(227, 103, 86, 0.3)',
                  borderRadius: 4,
                  color: '#E36756',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '3px 8px',
                  fontWeight: 500
                }}
                title={`Delete ${sectionTitle} section`}
              >
                🗑️ Delete Section
              </button>
            )}
          </div>
        </div>

        {showQuickAdd === sectionKey && (
          <div style={{ marginLeft: 20, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: '#999', fontSize: 10, marginBottom: 2 }}>Property Name</label>
              {sectionKey === 'custom_instructions' ? (
                <textarea
                  value={newRuleKey}
                  onChange={(e) => setNewRuleKey(e.target.value)}
                  placeholder="Enter custom instruction (e.g., Always mention ACL integrity status)..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    fontSize: 11,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey && newRuleKey) {
                      quickAddArrayItem([sectionKey], newRuleKey)
                    }
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={newRuleKey}
                  onChange={(e) => setNewRuleKey(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g., custom_property"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    fontSize: 11,
                    outline: 'none'
                  }}
                />
              )}
            </div>
            {sectionKey !== 'custom_instructions' && (
              <div>
                <label style={{ display: 'block', color: '#999', fontSize: 10, marginBottom: 2 }}>Type</label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as 'boolean' | 'string' | 'array')}
                  style={{
                    padding: '4px 6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    fontSize: 11,
                    outline: 'none'
                  }}
                >
                  <option value="boolean">Toggle</option>
                  <option value="string">Text</option>
                  <option value="array">List</option>
                </select>
              </div>
            )}
            <button
              onClick={() => {
                if (newRuleKey || sectionKey === 'custom_instructions') {
                  if (sectionKey === 'custom_instructions') {
                    // Handle array-based sections (custom_instructions)
                    if (newRuleKey) {
                      quickAddArrayItem([sectionKey], newRuleKey)
                    }
                  } else {
                    // Handle object-based sections  
                    const processedValue = newRuleType === 'boolean' ? false : newRuleType === 'array' ? [] : ''
                    setCurrentLogic(prev => ({
                      ...prev,
                      [sectionKey]: {
                        ...prev[sectionKey],
                        [newRuleKey]: processedValue
                      }
                    }))
                    setPendingChanges(prev => ({
                      ...prev,
                      [sectionKey]: {
                        ...currentLogic[sectionKey],
                        [newRuleKey]: processedValue
                      }
                    }))
                    setNewRuleKey('')
                    setNewRuleType('boolean')
                    setShowQuickAdd(null)
                    showToast('success', `Property added to ${sectionTitle}`)
                  }
                }
              }}
              style={{
                background: 'rgba(58, 188, 150, 0.3)',
                border: '1px solid rgba(58, 188, 150, 0.5)',
                borderRadius: 3,
                color: '#3ABC96',
                fontSize: 11,
                cursor: 'pointer',
                padding: '4px 10px'
              }}
            >
              Add
            </button>
          </div>
        )}

        <div style={{ marginLeft: 20 }}>
          {/* Handle arrays (custom_instructions, exclude_by_default) */}
          {Array.isArray(currentLogic[sectionKey]) && (
            <div>
              {currentLogic[sectionKey].length > 0 ? (
                currentLogic[sectionKey].map((item, index) => (
                  <div key={index} style={{ 
                    fontSize: 12, 
                    color: '#ccc', 
                    marginBottom: 8, 
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '4px 6px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <span style={{ flex: 1 }}>
                      {index + 1}. {item}
                    </span>
                    <button
                      onClick={() => removeArrayItem([sectionKey], index, item)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        fontSize: 12,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: 3,
                        opacity: 0.6
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '1'}
                      onMouseLeave={(e) => e.target.style.opacity = '0.6'}
                      title="Delete item"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ color: '#666', fontStyle: 'italic', fontSize: 11 }}>
                  No {sectionTitle.toLowerCase()}. Use the "+ Add Property" button above to add one.
                </div>
              )}
            </div>
          )}
          
          {/* Handle object properties */}
          {currentLogic[sectionKey] && typeof currentLogic[sectionKey] === 'object' && !Array.isArray(currentLogic[sectionKey]) && Object.entries(currentLogic[sectionKey]).map(([key, value]) => {
            // Handle nested arrays within objects (like impression.exclude_by_default)
            if (Array.isArray(value)) {
              const arrayPath = [sectionKey, key]
              const arrayKey = `${sectionKey}_${key}`
              return (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <h4 style={{ color: '#999', fontSize: 13, margin: 0, fontWeight: 500 }}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </h4>
                      {key === 'exclude_by_default' && (
                        <div style={{ color: '#666', fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                          Findings to omit from impression unless clinically relevant
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowQuickAdd(showQuickAdd === arrayKey ? null : arrayKey)}
                      style={{
                        background: 'rgba(58, 188, 150, 0.2)',
                        border: '1px solid rgba(58, 188, 150, 0.3)',
                        borderRadius: 3,
                        color: '#3ABC96',
                        fontSize: 10,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontWeight: 500
                      }}
                      title={`Add item to ${key.replace(/_/g, ' ')}`}
                    >
                      + Add Item
                    </button>
                  </div>
                  
                  {showQuickAdd === arrayKey && (
                    <div style={{ marginLeft: 12, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <input
                        type="text"
                        value={quickAddItem}
                        onChange={(e) => setQuickAddItem(e.target.value)}
                        placeholder={
                          key === 'exclude_by_default' 
                            ? 'e.g., mild joint effusion, trace popliteal cyst, degenerative changes' 
                            : 'Enter item'
                        }
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 3,
                          fontSize: 11,
                          outline: 'none'
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && quickAddItem.trim()) {
                            quickAddArrayItem(arrayPath, quickAddItem.trim())
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (quickAddItem.trim()) {
                            quickAddArrayItem(arrayPath, quickAddItem.trim())
                          }
                        }}
                        disabled={!quickAddItem.trim()}
                        style={{
                          background: quickAddItem.trim() ? 'rgba(58, 188, 150, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                          border: '1px solid rgba(58, 188, 150, 0.5)',
                          borderRadius: 3,
                          color: quickAddItem.trim() ? '#3ABC96' : '#666',
                          fontSize: 10,
                          cursor: quickAddItem.trim() ? 'pointer' : 'not-allowed',
                          padding: '4px 8px',
                          fontWeight: 500
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                  
                  <div style={{ marginLeft: 12 }}>
                    {value.length > 0 ? (
                      value.map((item, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 4,
                          fontSize: 11,
                          color: '#ccc',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <span style={{ flex: 1 }}>{item}</span>
                          <button
                            onClick={() => removeArrayItem(arrayPath, index, item)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ff6b6b',
                              fontSize: 12,
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: 3,
                              opacity: 0.6
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.6'}
                            title="Delete item"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#666', fontStyle: 'italic', fontSize: 10, padding: '4px 6px' }}>
                        No items. Use "+ Add Item" above to add exclusions.
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            
            const isDeletable = isPropertyDeletable(sectionKey, key)
            return (
              <div key={key} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: 8,
                padding: '4px 6px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  {typeof value === 'boolean' && (
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => handleCheckboxChange([sectionKey, key], e.target.checked)}
                      style={{ accentColor: '#3ABC96' }}
                    />
                  )}
                  <span style={{ fontSize: 14, color: '#fff' }}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  {typeof value === 'string' && (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        setCurrentLogic(prev => ({
                          ...prev,
                          [sectionKey]: {
                            ...prev[sectionKey],
                            [key]: e.target.value
                          }
                        }))
                        setPendingChanges(prev => ({
                          ...prev,
                          [sectionKey]: {
                            ...currentLogic[sectionKey],
                            [key]: e.target.value
                          }
                        }))
                      }}
                      style={{
                        marginLeft: 8,
                        padding: '2px 6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 3,
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                  )}
                  {typeof value === 'object' && !Array.isArray(value) && (
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>[nested object]</span>
                  )}
                </label>
                {isDeletable && (
                  <button
                    onClick={() => removeCustomRule(sectionKey, key)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ff6b6b',
                      fontSize: 14,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: 3,
                      opacity: 0.7
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '1'}
                    onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    title="Delete property"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Helper function to handle checkbox changes with proper functional state updates
  const handleCheckboxChange = (path: string[], checked: boolean) => {
    console.log('Checkbox change:', path.join('.'), '=', checked)
    
    setCurrentLogic(prev => {
      const updatedCurrentLogic = JSON.parse(JSON.stringify(prev)) // Deep clone
      let current = updatedCurrentLogic
      
      // Navigate to parent object
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {}
        current = current[path[i]]
      }
      
      // Set final value
      current[path[path.length - 1]] = checked
      
      // Update pending changes by just setting individual properties
      // Since we're now sending the complete currentLogic, we don't need complex merging
      setPendingChanges(prevPending => {
        const updated = JSON.parse(JSON.stringify(prevPending || {})) // Deep clone
        
        // Just set the specific property that changed
        let current = updated
        for (let i = 0; i < path.length - 1; i++) {
          if (!current[path[i]]) current[path[i]] = {}
          current = current[path[i]]
        }
        current[path[path.length - 1]] = checked
        
        console.log('Updated pending changes:', path.join('.'), '=', checked)
        return updated
      })
      
      return updatedCurrentLogic
    })
  }
  
  const [selectedStudyType, setSelectedStudyType] = useState<string>(defaultStudyType)
  const [currentLogic, setCurrentLogic] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<any>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAddRule, setShowAddRule] = useState(false)
  const [newRuleCategory, setNewRuleCategory] = useState('')
  const [newRuleKey, setNewRuleKey] = useState('')
  const [newRuleValue, setNewRuleValue] = useState('')
  const [newRuleType, setNewRuleType] = useState<'boolean' | 'string' | 'array'>('boolean')
  const [quickAddItem, setQuickAddItem] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null)

  // Load current logic when study type changes
  useEffect(() => {
    if (selectedStudyType && selectedStudyType.trim()) {
      loadCurrentLogic()
    } else {
      setCurrentLogic(null)
    }
  }, [selectedStudyType, userId])

  const loadCurrentLogic = async () => {
    if (!selectedStudyType || !selectedStudyType.trim()) return
    
    // Don't check templates since they may not be loaded yet
    // The getCurrentAgentLogicWithOffline will handle fetching from Supabase directly
    
    try {
      setIsLoading(true)
      console.log('Loading logic for:', selectedStudyType)
      
      const result = await getCurrentAgentLogicWithOffline(userId, selectedStudyType, isOfflineMode)
      
      if (result.logic && !result.error) {
        console.log('Logic loaded successfully:', result.logic)
        console.log('📥 numerically_itemized loaded as:', result.logic?.impression?.numerically_itemized)
        setCurrentLogic(result.logic)
      } else {
        console.error('Failed to load logic:', result.error)
        // Initialize with default logic if none exists
        setCurrentLogic({
          version: "2.0",
          formatting: {
            preserve_template_punctuation: true,
            use_bullet_points: false,
            capitalize_sections: true
          },
          impression: {
            numerically_itemized: true,
            concise_summary: true
          }
        })
      }
    } catch (error) {
      console.error('Error loading current logic:', error)
      // Initialize with default logic on error
      setCurrentLogic({
        version: "2.0",
        formatting: {
          preserve_template_punctuation: true,
          use_bullet_points: false,
          capitalize_sections: true
        },
        impression: {
          numerically_itemized: true,
          concise_summary: true
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Save pending changes
  const saveChanges = async () => {
    if (!pendingChanges || Object.keys(pendingChanges).length === 0) return
    
    console.log('💾 Saving changes:', pendingChanges)
    console.log('💾 Current logic before save:', currentLogic)
    console.log('💾 Current logic formatting before save:', currentLogic.formatting)
    console.log('💾 Pending changes formatting:', pendingChanges.formatting)
    
    // Fix: Build complete pending changes by including full sections
    const completePendingChanges = JSON.parse(JSON.stringify(pendingChanges))
    
    // For each section in pendingChanges, include the complete current UI state
    Object.keys(pendingChanges).forEach(sectionName => {
      if (currentLogic[sectionName] && typeof currentLogic[sectionName] === 'object') {
        console.log(`🔧 Completing section "${sectionName}" with full UI state`)
        console.log(`🔧   - Original pendingChanges.${sectionName}:`, pendingChanges[sectionName])
        console.log(`🔧   - Current UI state for ${sectionName}:`, currentLogic[sectionName])
        
        // Replace with complete current UI state
        completePendingChanges[sectionName] = JSON.parse(JSON.stringify(currentLogic[sectionName]))
        
        console.log(`🔧   - Complete pendingChanges.${sectionName}:`, completePendingChanges[sectionName])
      }
    })
    
    setIsSaving(true)
    try {
      
      const updateResult = await updateAgentLogicWithOffline(userId, selectedStudyType, completePendingChanges, isOfflineMode)
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update logic')
      }
      
      console.log('💾 Save result final logic:', updateResult.finalLogic)
      console.log('💾 Save result final logic formatting:', updateResult.finalLogic?.formatting)
      console.log('💾 numerically_itemized in final logic:', updateResult.finalLogic?.impression?.numerically_itemized)
      
      setCurrentLogic(updateResult.finalLogic)
      setPendingChanges(null)
      showToast('success', 'Settings saved successfully!')
      
    } catch (error) {
      console.error('Failed to save changes:', error)
      showToast('error', `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Add new custom rule
  const addCustomRule = () => {
    if (!newRuleCategory || !newRuleKey) {
      showToast('error', 'Category and rule name are required')
      return
    }

    const processedValue = newRuleType === 'boolean' ? true : 
                          newRuleType === 'array' ? (newRuleValue ? newRuleValue.split('\n').map(s => s.trim()).filter(s => s) : []) :
                          newRuleValue

    const newLogic = { ...currentLogic }
    
    // Create nested structure if it doesn't exist
    if (!newLogic[newRuleCategory]) {
      newLogic[newRuleCategory] = {}
    }

    // Add the new rule
    newLogic[newRuleCategory][newRuleKey] = processedValue

    setCurrentLogic(newLogic)
    setPendingChanges({
      ...pendingChanges,
      [newRuleCategory]: {
        ...pendingChanges?.[newRuleCategory],
        [newRuleKey]: processedValue
      }
    })

    // Reset form
    setNewRuleCategory('')
    setNewRuleKey('')
    setNewRuleValue('')
    setNewRuleType('boolean')
    setShowAddRule(false)

    showToast('success', 'Custom rule added successfully!')
  }

  // Remove property
  const removeCustomRule = (category: string, key: string) => {
    const ruleName = key.replace(/_/g, ' ')
    const categoryName = category.replace(/_/g, ' ')
    
    const confirmed = window.confirm(
      `Are you sure you want to delete the property "${ruleName}" from the ${categoryName} category?\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }

    setCurrentLogic(prev => {
      const newLogic = JSON.parse(JSON.stringify(prev))
      if (newLogic[category] && newLogic[category][key] !== undefined) {
        delete newLogic[category][key]
        
        // Remove category if empty
        if (Object.keys(newLogic[category]).length === 0) {
          delete newLogic[category]
        }
      }
      return newLogic
    })

    setPendingChanges(prev => {
      const updated = JSON.parse(JSON.stringify(prev || {}))
      if (!updated[category]) updated[category] = {}
      
      // Mark property as deleted by setting to undefined
      updated[category][key] = undefined
      
      // Include the entire section to ensure proper save
      if (currentLogic[category]) {
        const sectionCopy = JSON.parse(JSON.stringify(currentLogic[category]))
        delete sectionCopy[key]
        updated[category] = sectionCopy
      }
      
      return updated
    })

    showToast('success', 'Property removed')
  }

  // Quick add item to array
  const quickAddArrayItem = (arrayPath: string[], item: string) => {
    if (!item.trim()) {
      showToast('error', 'Item cannot be empty')
      return
    }

    let updatedLogic: any

    setCurrentLogic(prev => {
      updatedLogic = JSON.parse(JSON.stringify(prev))
      
      // Navigate to the array, creating structure if needed
      let current = updatedLogic
      for (let i = 0; i < arrayPath.length - 1; i++) {
        if (!current[arrayPath[i]]) current[arrayPath[i]] = {}
        current = current[arrayPath[i]]
      }
      
      // Initialize array if it doesn't exist
      const arrayName = arrayPath[arrayPath.length - 1]
      if (!Array.isArray(current[arrayName])) {
        current[arrayName] = []
      }
      
      // Add the new item
      current[arrayName].push(item.trim())
      
      return updatedLogic
    })

    // Update pending changes
    setPendingChanges(prev => {
      const updated = JSON.parse(JSON.stringify(prev || {}))
      
      // For arrays at the root level
      if (arrayPath.length === 1) {
        updated[arrayPath[0]] = [...updatedLogic[arrayPath[0]]]
      } else {
        // For nested arrays
        const sectionName = arrayPath[0]
        if (updatedLogic[sectionName]) {
          updated[sectionName] = JSON.parse(JSON.stringify(updatedLogic[sectionName]))
        }
      }
      
      return updated
    })

    // Reset form
    setQuickAddItem('')
    setShowQuickAdd(null)
    showToast('success', 'Item added successfully!')
  }

  // Remove item from array (custom instructions, exclude_by_default, etc.)
  const removeArrayItem = (arrayPath: string[], index: number, itemPreview: string) => {
    const pathDescription = arrayPath.join('.')
    const confirmed = window.confirm(
      `Are you sure you want to delete this item from ${pathDescription}?\n\n"${itemPreview}"\n\nThis action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }

    let updatedLogic: any

    setCurrentLogic(prev => {
      updatedLogic = JSON.parse(JSON.stringify(prev))
      
      // Navigate to the array
      let current = updatedLogic
      for (let i = 0; i < arrayPath.length - 1; i++) {
        current = current[arrayPath[i]]
      }
      
      // Remove the item from the array
      const arrayName = arrayPath[arrayPath.length - 1]
      if (Array.isArray(current[arrayName])) {
        current[arrayName].splice(index, 1)
      }
      
      return updatedLogic
    })

    // Update pending changes - include the entire section containing the modified array
    setPendingChanges(prev => {
      const updated = JSON.parse(JSON.stringify(prev || {}))
      
      // For arrays at the root level (like custom_instructions)
      if (arrayPath.length === 1) {
        updated[arrayPath[0]] = [...updatedLogic[arrayPath[0]]]
      } else {
        // For nested arrays (like impression.exclude_by_default)
        const sectionName = arrayPath[0]
        if (updatedLogic[sectionName]) {
          updated[sectionName] = JSON.parse(JSON.stringify(updatedLogic[sectionName]))
        }
      }
      
      return updated
    })

    showToast('success', 'Item removed')
  }

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

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
        maxWidth: 1000,
        height: '90vh',
        backgroundColor: 'rgb(40, 44, 52)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.3)'
        }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 600 }}>
              ⚡ Direct Logic Editor
            </h2>
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <input
                list="logic-study-types"
                value={selectedStudyType}
                onChange={(e) => setSelectedStudyType(e.target.value)}
                placeholder="Select or search study type..."
                disabled={false}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: selectedStudyType ? '#fff' : '#999',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <datalist id="logic-study-types">
                {templates && Object.keys(templates).sort().map(studyType => (
                  <option key={studyType} value={studyType} />
                ))}
              </datalist>
            </div>
            
            <p style={{ color: '#999', margin: 0, fontSize: 14 }}>
              {selectedStudyType 
                ? `Editing logic for ${selectedStudyType}`
                : 'Select a study type to edit its logic'
              }
            </p>
            <p style={{ color: '#3ABC96', margin: '4px 0 0 0', fontSize: 12, fontWeight: 500 }}>
              ⚡ Direct Editor{isOfflineMode && ' • 🔌 Offline Mode'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: 24,
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          color: '#fff'
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              Loading logic configuration...
            </div>
          ) : currentLogic ? (
            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
              {/* Dynamic Sections */}
              {renderDynamicSection('formatting', 'Formatting', '📝')}
              {renderDynamicSection('report', 'Report Settings', '📋')}
              
              {/* Cartilage Placement - Special nested section under report */}
              {currentLogic.report?.cartilage_placement && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ color: '#3ABC96', margin: 0 }}>🦴 Cartilage Placement</h3>
                    <button
                      onClick={() => setShowQuickAdd(showQuickAdd === 'cartilage_placement' ? null : 'cartilage_placement')}
                      style={{
                        background: 'rgba(58, 188, 150, 0.2)',
                        border: '1px solid rgba(58, 188, 150, 0.3)',
                        borderRadius: 4,
                        color: '#3ABC96',
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        fontWeight: 500
                      }}
                      title="Add custom property"
                    >
                      + Add Property
                    </button>
                  </div>
                  
                  {showQuickAdd === 'cartilage_placement' && (
                    <div style={{ marginLeft: 20, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#999', fontSize: 10, marginBottom: 2 }}>Property Name</label>
                        <input
                          type="text"
                          value={newRuleKey}
                          onChange={(e) => setNewRuleKey(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                          placeholder="e.g., lateral_compartment"
                          style={{
                            width: '100%',
                            padding: '4px 6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 3,
                            fontSize: 11,
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#999', fontSize: 10, marginBottom: 2 }}>Type</label>
                        <select
                          value={newRuleType}
                          onChange={(e) => setNewRuleType(e.target.value as 'boolean' | 'string' | 'array')}
                          style={{
                            padding: '4px 6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 3,
                            fontSize: 11,
                            outline: 'none'
                          }}
                        >
                          <option value="boolean">Toggle</option>
                          <option value="string">Text</option>
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          if (newRuleKey) {
                            const processedValue = newRuleType === 'boolean' ? false : ''
                            setCurrentLogic(prev => {
                              const updated = JSON.parse(JSON.stringify(prev))
                              if (!updated.report.cartilage_placement) updated.report.cartilage_placement = {}
                              updated.report.cartilage_placement[newRuleKey] = processedValue
                              return updated
                            })
                            setPendingChanges(prev => {
                              const updated = JSON.parse(JSON.stringify(prev || {}))
                              if (!updated.report) updated.report = {}
                              updated.report = JSON.parse(JSON.stringify(currentLogic.report))
                              if (!updated.report.cartilage_placement) updated.report.cartilage_placement = {}
                              updated.report.cartilage_placement[newRuleKey] = processedValue
                              return updated
                            })
                            setNewRuleKey('')
                            setShowQuickAdd(null)
                            showToast('success', 'Property added to Cartilage Placement')
                          }
                        }}
                        style={{
                          background: 'rgba(58, 188, 150, 0.3)',
                          border: '1px solid rgba(58, 188, 150, 0.5)',
                          borderRadius: 3,
                          color: '#3ABC96',
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: '4px 10px'
                        }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                  
                  <div style={{ marginLeft: 20 }}>
                    {Object.entries(currentLogic.report.cartilage_placement).map(([key, value]) => {
                      return (
                        <div key={key} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          marginBottom: 8,
                          padding: '4px 6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 4,
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                            {typeof value === 'boolean' && (
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => handleCheckboxChange(['report', 'cartilage_placement', key], e.target.checked)}
                                style={{ accentColor: '#3ABC96' }}
                              />
                            )}
                            <span style={{ fontSize: 14, color: '#fff' }}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                            {typeof value === 'string' && (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => {
                                  setCurrentLogic(prev => {
                                    const updated = JSON.parse(JSON.stringify(prev))
                                    updated.report.cartilage_placement[key] = e.target.value
                                    return updated
                                  })
                                  setPendingChanges(prev => {
                                    const updated = JSON.parse(JSON.stringify(prev || {}))
                                    if (!updated.report) updated.report = {}
                                    updated.report = JSON.parse(JSON.stringify(currentLogic.report))
                                    updated.report.cartilage_placement[key] = e.target.value
                                    return updated
                                  })
                                }}
                                style={{
                                  marginLeft: 8,
                                  padding: '2px 6px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  color: '#fff',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: 3,
                                  fontSize: 12,
                                  outline: 'none'
                                }}
                              />
                            )}
                          </label>
                          <button
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Are you sure you want to delete "${key.replace(/_/g, ' ')}" from Cartilage Placement?\n\nThis action cannot be undone.`
                              )
                              if (confirmed) {
                                setCurrentLogic(prev => {
                                  const updated = JSON.parse(JSON.stringify(prev))
                                  delete updated.report.cartilage_placement[key]
                                  if (Object.keys(updated.report.cartilage_placement).length === 0) {
                                    delete updated.report.cartilage_placement
                                  }
                                  return updated
                                })
                                setPendingChanges(prev => {
                                  const updated = JSON.parse(JSON.stringify(prev || {}))
                                  if (!updated.report) updated.report = {}
                                  updated.report = JSON.parse(JSON.stringify(currentLogic.report))
                                  delete updated.report.cartilage_placement[key]
                                  if (Object.keys(updated.report.cartilage_placement).length === 0) {
                                    delete updated.report.cartilage_placement
                                  }
                                  return updated
                                })
                                showToast('success', 'Property removed')
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ff6b6b',
                              fontSize: 14,
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: 3,
                              opacity: 0.7
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                            title="Delete custom property"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {renderDynamicSection('impression', 'Impression', '🎯')}
              {renderDynamicSection('anatomy', 'Anatomy', '🦴')}
              {renderDynamicSection('clinical', 'Clinical', '🩺')}
              {renderDynamicSection('measurements', 'Measurements', '📏')}
              {renderDynamicSection('severity', 'Severity', '⚠️')}
              {renderDynamicSection('style', 'Style', '✍️')}
              
              {/* Custom Instructions - Special handling for arrays */}
              {renderDynamicSection('custom_instructions', 'Custom Instructions', '✨')}
              
              {/* Render any additional custom sections */}
              {currentLogic && Object.keys(currentLogic)
                .filter(key => !['formatting', 'report', 'impression', 'anatomy', 'clinical', 'measurements', 'severity', 'style', 'custom_instructions', 'version'].includes(key))
                .map(sectionKey => {
                  const sectionTitle = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return renderDynamicSection(sectionKey, sectionTitle, '⚙️')
                })
              }
              
              {/* Add New Section Button */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  onClick={() => setShowQuickAdd(showQuickAdd === 'new_section' ? null : 'new_section')}
                  style={{
                    background: 'rgba(58, 188, 150, 0.2)',
                    border: '1px solid rgba(58, 188, 150, 0.3)',
                    borderRadius: 6,
                    color: '#3ABC96',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: '8px 16px',
                    fontWeight: 500,
                    width: '100%'
                  }}
                  title="Add a new section"
                >
                  ➕ Add New Section
                </button>
                
                {showQuickAdd === 'new_section' && (
                  <div style={{ marginTop: 12, padding: '12px', backgroundColor: 'rgba(58, 188, 150, 0.05)', borderRadius: 6, border: '1px solid rgba(58, 188, 150, 0.2)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#3ABC96', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>Section Name</label>
                        <input
                          type="text"
                          value={newRuleKey}
                          onChange={(e) => setNewRuleKey(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                          placeholder="e.g., advanced_settings"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#fff',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: 4,
                            fontSize: 12,
                            outline: 'none'
                          }}
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (newRuleKey && !currentLogic[newRuleKey]) {
                            setCurrentLogic(prev => ({
                              ...prev,
                              [newRuleKey]: {}
                            }))
                            setPendingChanges(prev => ({
                              ...prev,
                              [newRuleKey]: {}
                            }))
                            setNewRuleKey('')
                            setShowQuickAdd(null)
                            showToast('success', `Section "${newRuleKey.replace(/_/g, ' ')}" created`)
                          }
                        }}
                        disabled={!newRuleKey || currentLogic[newRuleKey]}
                        style={{
                          background: (!newRuleKey || currentLogic[newRuleKey]) ? 'rgba(100, 100, 100, 0.3)' : 'rgba(58, 188, 150, 0.3)',
                          border: '1px solid rgba(58, 188, 150, 0.5)',
                          borderRadius: 4,
                          color: (!newRuleKey || currentLogic[newRuleKey]) ? '#666' : '#3ABC96',
                          fontSize: 11,
                          cursor: (!newRuleKey || currentLogic[newRuleKey]) ? 'not-allowed' : 'pointer',
                          padding: '6px 12px',
                          fontWeight: 500
                        }}
                      >
                        Create Section
                      </button>
                    </div>
                    {newRuleKey && currentLogic[newRuleKey] && (
                      <div style={{ marginTop: 8, color: '#E36756', fontSize: 11 }}>
                        Section "{newRuleKey}" already exists
                      </div>
                    )}
                  </div>
                )}
              </div>
              
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              No logic configuration found
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {pendingChanges && Object.keys(pendingChanges).length > 0 && (
              <span style={{ color: '#ff9500', fontSize: 12 }}>
                Unsaved changes
              </span>
            )}
            <button
              onClick={saveChanges}
              disabled={isSaving || !pendingChanges || Object.keys(pendingChanges || {}).length === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSaving) 
                  ? 'rgba(100, 100, 100, 0.3)' 
                  : 'rgba(58, 188, 150, 0.2)',
                border: '1px solid rgba(58, 188, 150, 0.3)',
                borderRadius: 6,
                color: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSaving) ? '#666' : '#3ABC96',
                fontSize: 14,
                cursor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSaving) ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Message */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: toastMessage.type === 'success' ? 'rgba(58, 188, 150, 0.9)' : 'rgba(227, 103, 86, 0.9)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 8,
          zIndex: 30000,
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          {toastMessage.text}
        </div>
      )}
    </div>
  )
}
