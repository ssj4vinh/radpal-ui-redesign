import React, { useState, useEffect } from 'react'
import { updateAgentLogicWithOffline, resetAgentLogicToDefaultWithOffline, getCurrentAgentLogicWithOffline } from '../supabase/updateAgentLogicWithOffline'

interface LogicEditorProps {
  userId: string
  studyType: string
  templates?: Record<string, any>
  onClose: () => void
  isOfflineMode?: boolean
}

// Helper function to get nested values safely
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

export default function LogicEditor({ userId, studyType, templates = {}, onClose, isOfflineMode = false }: LogicEditorProps) {
  // Early return if essential props are missing
  if (!userId || !onClose) {
    console.error('LogicEditor: Missing essential props (userId or onClose)')
    return null
  }

  const [selectedStudyType, setSelectedStudyType] = useState<string>(studyType)
  const [isLoading, setIsLoading] = useState(false)
  const [currentLogic, setCurrentLogic] = useState<any>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pendingChanges, setPendingChanges] = useState<any>(null)
  const [isSavingChanges, setIsSavingChanges] = useState(false)

  // Helper function to handle logic value changes
  const handleLogicChange = (path: string[], newValue: any) => {
    console.log('Logic change:', path.join('.'), '=', newValue, 'at', new Date().getTime())
    
    // Convert spaces to underscores for string values and arrays before saving
    let processedValue = newValue
    if (typeof newValue === 'string') {
      processedValue = newValue.replace(/\s+/g, '_').toLowerCase()
    } else if (Array.isArray(newValue)) {
      processedValue = newValue.map(item => 
        typeof item === 'string' ? item.replace(/\s+/g, '_').toLowerCase() : item
      )
    }
    
    // Use functional state updates to prevent race conditions
    setCurrentLogic(prevLogic => {
      if (!prevLogic) {
        console.error('LogicEditor: prevLogic is null/undefined in setCurrentLogic')
        return prevLogic
      }
      
      console.log('Before update - path:', path.join('.'), 'current value:', getNestedValue(prevLogic, path))
      const updatedLogic = JSON.parse(JSON.stringify(prevLogic)) // Deep clone
      
      // Navigate to the nested property and update it
      let current = updatedLogic
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {}
        }
        current = current[path[i]]
      }
      current[path[path.length - 1]] = processedValue
      
      console.log('After update - path:', path.join('.'), 'new value:', getNestedValue(updatedLogic, path))
      return updatedLogic
    })
    
    setPendingChanges(prevChanges => {
      const changes = JSON.parse(JSON.stringify(prevChanges || {})) // Deep clone
      
      // Navigate to the nested property and update it
      let changesCurrent = changes
      for (let i = 0; i < path.length - 1; i++) {
        if (!changesCurrent[path[i]]) {
          changesCurrent[path[i]] = {}
        }
        changesCurrent = changesCurrent[path[i]]
      }
      changesCurrent[path[path.length - 1]] = processedValue
      
      console.log('Pending changes:', changes)
      return changes
    })
  }

  // Save pending changes
  const savePendingChanges = async () => {
    if (!pendingChanges || Object.keys(pendingChanges).length === 0) return
    
    setIsSavingChanges(true)
    try {
      const updateResult = await updateAgentLogicWithOffline(userId, selectedStudyType, pendingChanges, isOfflineMode)
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update logic')
      }
      
      setCurrentLogic(updateResult.finalLogic)
      setPendingChanges(null)
      showToast('success', 'Settings saved successfully!')
      
    } catch (error) {
      console.error('Failed to save changes:', error)
      showToast('error', `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSavingChanges(false)
    }
  }

  // Format section names for display
  const formatSectionName = (key: string) => {
    const formatted = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    
    const icons: Record<string, string> = {
      'Formatting': '📝',
      'Report': '📄',
      'Impression': '🎯',
      'Anatomy': '🦴',
      'Clinical': '🩺',
      'Measurements': '📏',
      'Severity': '⚠️',
      'Style': '✍️'
    }
    
    return `${icons[formatted] || '⚙️'} ${formatted}`
  }

  // Format values for display
  const formatValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'string' ? v.replace(/_/g, ' ') : v).join(', ')
    }
    if (typeof value === 'string') {
      return value.replace(/_/g, ' ')
    }
    return String(value)
  }

  // Render the logic editor recursively
  const renderSection = (obj: any, path: string[] = [], depth: number = 0): React.ReactNode => {
    if (!obj || typeof obj !== 'object') return null

    return Object.entries(obj).map(([key, value]) => {
      // Skip version and custom_instructions in main display
      if (depth === 0 && (key === 'version' || key === 'custom_instructions')) {
        return null
      }

      const currentPath = [...path, key]
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
      const formattedKey = depth === 0 ? formatSectionName(key) : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      
      return (
        <div key={currentPath.join('.')} style={{ marginLeft: depth * 20, marginBottom: depth === 0 ? 12 : 6 }}>
          {isObject ? (
            <>
              <div style={{ 
                fontWeight: depth === 0 ? 600 : 500, 
                color: depth === 0 ? '#3ABC96' : '#fff',
                marginBottom: 6,
                fontSize: depth === 0 ? 14 : 13
              }}>
                {formattedKey}
              </div>
              {renderSection(value, currentPath, depth + 1)}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#999', fontSize: 12 }}>•</span>
              <span style={{ color: '#aaa', flex: 1, fontSize: 12 }}>
                {formattedKey}:
              </span>
              {typeof value === 'boolean' ? (
                <label htmlFor={`checkbox-${currentPath.join('.')}`} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  gap: 6
                }}>
                  <input
                    type="checkbox"
                    id={`checkbox-${currentPath.join('.')}`}
                    checked={value}
                    onChange={(e) => handleLogicChange(currentPath, e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: 'pointer',
                      accentColor: '#3ABC96'
                    }}
                  />
                  <span style={{ 
                    color: value ? '#3ABC96' : '#E36756',
                    fontWeight: 500,
                    fontSize: 12
                  }}>
                    {value ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </label>
              ) : Array.isArray(value) ? (
                <input
                  type="text"
                  value={value.map(v => typeof v === 'string' ? v.replace(/_/g, ' ') : v).join(', ')}
                  onChange={(e) => {
                    const newArray = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                    handleLogicChange(currentPath, newArray)
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 200,
                    outline: 'none'
                  }}
                  placeholder="Enter items separated by commas"
                />
              ) : typeof value === 'string' ? (
                <input
                  type="text"
                  value={value.replace(/_/g, ' ')}
                  onChange={(e) => handleLogicChange(currentPath, e.target.value)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    color: '#fff',
                    fontSize: 12,
                    minWidth: 150,
                    outline: 'none'
                  }}
                />
              ) : (
                <span style={{ color: '#fff', fontSize: 12 }}>
                  {formatValue(value)}
                </span>
              )}
            </div>
          )}
        </div>
      )
    }).filter(Boolean)
  }

  // Load current logic when study type changes
  useEffect(() => {
    if (selectedStudyType && selectedStudyType.trim()) {
      setCurrentLogic(null)
      
      // Debounce the API call to prevent too many calls while typing
      const timeoutId = setTimeout(() => {
        loadCurrentLogic()
      }, 800)
      
      return () => clearTimeout(timeoutId)
    } else {
      setCurrentLogic(null)
    }
  }, [selectedStudyType, userId])

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const loadCurrentLogic = async () => {
    if (!selectedStudyType || !selectedStudyType.trim()) return
    
    // Check if the study type exists in templates
    const availableStudyTypes = Object.keys(templates || {})
    if (availableStudyTypes.length > 0 && !availableStudyTypes.includes(selectedStudyType)) {
      console.log('Study type not found in templates:', selectedStudyType)
      return
    }
    
    try {
      setIsLoading(true)
      console.log('Loading logic for:', selectedStudyType)
      
      const result = await getCurrentAgentLogicWithOffline(userId, selectedStudyType, isOfflineMode)
      
      if (result.success && result.logic) {
        console.log('Logic loaded successfully:', result.logic)
        setCurrentLogic(result.logic)
      } else {
        console.error('Failed to load logic:', result.error)
      }
    } catch (error) {
      console.error('Error loading current logic:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
  }

  const handleResetLogic = async () => {
    if (!selectedStudyType) return

    try {
      setIsLoading(true)
      const result = await resetAgentLogicToDefaultWithOffline(userId, selectedStudyType, isOfflineMode)
      
      if (result.success) {
        setCurrentLogic(result.logic)
        setPendingChanges(null)
        showToast('success', 'Logic reset to default!')
      } else {
        throw new Error(result.error || 'Failed to reset logic')
      }
    } catch (error) {
      console.error('Failed to reset logic:', error)
      showToast('error', `Failed to reset logic: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setShowResetConfirm(false)
    }
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
              Logic Editor
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

        {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* Logic Editor Panel */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto'
          }}>
            {isLoading ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '200px',
                color: '#999' 
              }}>
                Loading logic configuration...
              </div>
            ) : currentLogic ? (
              <div>
                {currentLogic.version && (
                  <div style={{ color: '#666', fontSize: 11, marginBottom: 12 }}>
                    Version: {currentLogic.version}
                  </div>
                )}
                {renderSection(currentLogic)}
                {currentLogic.custom_instructions && currentLogic.custom_instructions.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ fontWeight: 600, color: '#3ABC96', marginBottom: 8, fontSize: 14 }}>
                      📝 Custom Instructions
                    </div>
                    {currentLogic.custom_instructions.map((instruction: string, index: number) => (
                      <div key={index} style={{ marginLeft: 20, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#666', fontSize: 11 }}>{index + 1}.</span>
                        <span style={{ color: '#ccc', fontSize: 12 }}>{instruction}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '200px',
                color: '#999',
                textAlign: 'center'
              }}>
                {selectedStudyType ? 
                  `No logic configuration found for "${selectedStudyType}"` :
                  'Select a study type to edit its logic configuration'
                }
              </div>
            )}
          </div>
        </div>

        {/* Footer with Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isLoading || !selectedStudyType}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(227, 103, 86, 0.2)',
                border: '1px solid rgba(227, 103, 86, 0.3)',
                borderRadius: 6,
                color: isLoading || !selectedStudyType ? '#666' : '#E36756',
                fontSize: 12,
                cursor: isLoading || !selectedStudyType ? 'not-allowed' : 'pointer',
                opacity: isLoading || !selectedStudyType ? 0.5 : 1
              }}
            >
              Reset to Default
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {pendingChanges && Object.keys(pendingChanges).length > 0 && (
              <span style={{ color: '#ff9500', fontSize: 12 }}>
                Unsaved changes
              </span>
            )}
            <button
              onClick={savePendingChanges}
              disabled={isSavingChanges || !pendingChanges || Object.keys(pendingChanges || {}).length === 0}
              style={{
                padding: '10px 20px',
                backgroundColor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSavingChanges) 
                  ? 'rgba(100, 100, 100, 0.3)' 
                  : 'rgba(58, 188, 150, 0.2)',
                border: '1px solid rgba(58, 188, 150, 0.3)',
                borderRadius: 6,
                color: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSavingChanges) ? '#666' : '#3ABC96',
                fontSize: 14,
                cursor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSavingChanges) ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              {isSavingChanges ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgb(40, 44, 52)',
            borderRadius: 8,
            padding: '20px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 12px 0' }}>Reset Logic</h3>
            <p style={{ color: '#ccc', margin: '0 0 20px 0', fontSize: 14 }}>
              This will reset all logic settings for "{selectedStudyType}" to the default configuration. 
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 4,
                  color: '#ccc',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetLogic}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(227, 103, 86, 0.2)',
                  border: '1px solid rgba(227, 103, 86, 0.3)',
                  borderRadius: 4,
                  color: '#E36756',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1
                }}
              >
                {isLoading ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

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