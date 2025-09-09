
import React, { useState, useEffect, useRef } from 'react'
import BlurCard from './BlurCard'

// Base study types that are always available
const baseStudyTypes = [
  'MRI Ankle', 'MRI Foot', 'MRI Knee', 'MRI Hip',
  'MRI Shoulder', 'MRI Elbow', 'MRI Wrist', 'MRI Hand',
  'MRI Cervical Spine', 'MRI Thoracic Spine', 'MRI Lumbar Spine', 'MRI Total Spine',
  'CT Generic', 'MRI Generic', 'CT Abdomen Pelvis', 'CT Pulmonary Embolism', 'CT Chest', 'CT Head'
]

interface Props {
  templates: Record<string, {
    template: string
    generate_prompt: string
    generate_impression?: string
    showDiffView?: boolean
    keywords?: string[]
  }>
  onSave: (studyType: string, template: string, generatePrompt: string, generateImpression?: string, showDiffView?: boolean) => void
  onSaveWithAgentLogic?: (studyType: string, template: string, agentLogic: Record<string, any>, showDiffView?: boolean, keywords?: string[]) => void
  onDelete?: (studyType: string) => void
  isOfflineMode?: boolean
}

export default function TemplateManager({ templates, onSave, onSaveWithAgentLogic, onDelete, isOfflineMode }: Props) {
  // Combine base study types with ones from templates
  const allStudyTypes = [...new Set([...baseStudyTypes, ...Object.keys(templates)])]
  
  const [selected, setSelected] = useState(allStudyTypes[0] || '')
  const [status, setStatus] = useState<string | null>(null)
  const [showAddNew, setShowAddNew] = useState(false)
  const [newStudyTypeName, setNewStudyTypeName] = useState('')
  const [newStudyTypeTemplate, setNewStudyTypeTemplate] = useState('')
  const [newStudyTypeKeywords, setNewStudyTypeKeywords] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Track edits for each template separately
  const [edits, setEdits] = useState<Record<string, {
    template: string
    showDiffView?: boolean
    keywords?: string[]
    keywordsRaw?: string // Temporary storage for raw keyword input
  }>>({})

  const templateRef = useRef<HTMLTextAreaElement>(null)
  const newStudyTypeNameRef = useRef<HTMLInputElement>(null)
  const newStudyTypeTemplateRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Default to the first item in the dropdown list (allStudyTypes)
    if (allStudyTypes.length > 0) {
      setSelected(allStudyTypes[0]) // Always default to the first study type
    }
  }, [templates])

  // Save current edits before switching templates
  const saveCurrentEdits = () => {
    if (templateRef.current) {
      setEdits(prev => ({
        ...prev,
        [selected]: {
          ...prev[selected],
          template: templateRef.current!.value
        }
      }))
    }
  }

  useEffect(() => {
    setStatus(null)
  }, [selected])

  // Clear edits when templates are updated (after successful save)
  useEffect(() => {
    setEdits(prevEdits => {
      // Check if any of our edits match the saved templates
      const newEdits = { ...prevEdits }
      let hasChanges = false
      
      Object.keys(newEdits).forEach(studyType => {
        const edit = newEdits[studyType]
        const template = templates[studyType]
        
        if (template && edit.template === template.template) {
          // This edit has been saved, remove it
          delete newEdits[studyType]
          hasChanges = true
        }
      })
      
      return hasChanges ? newEdits : prevEdits
    })
  }, [templates])

  const handleSave = async () => {
    try {
      // Save current edits first
      saveCurrentEdits()
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const currentEdit = edits[selected] || {}
      const current = templates[selected] || {}
      
      // Process keywords if there's raw text
      let keywords = currentEdit.keywords
      if (currentEdit.keywordsRaw !== undefined) {
        keywords = currentEdit.keywordsRaw
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)
      }
      
      await onSave(
        selected,
        currentEdit.template ?? templateRef.current?.value ?? current.template ?? '',
        current.generate_prompt ?? '',
        current.generate_impression ?? '',
        currentEdit.showDiffView ?? current.showDiffView ?? true
      )
      
      // Also save keywords if they've been edited
      if (keywords !== undefined) {
        await window.electron?.ipcRenderer?.invoke('update-template-keywords', selected, keywords)
        
        // Clear the edits completely to force UI to use fresh templates data
        setEdits(prev => {
          const newEdits = { ...prev }
          delete newEdits[selected]
          return newEdits
        })
        
        // Trigger templates refresh via IPC to notify all components
        // This will cause the parent to refetch templates
        const user = await window.electron?.ipcRenderer?.invoke('get-current-user')
        if (user?.id) {
          window.electron?.ipcRenderer?.send('templates-updated', { userId: user.id })
        }
      }
      
      // Don't clear edits immediately - let them persist until templates prop updates
      // This prevents the UI from reverting to old values
      // No status message shown on successful save
    } catch (err) {
      console.error(err)
      setStatus('❌ Save failed')
    }
  }

  const handleAddNewStudyType = async () => {
    if (!newStudyTypeName.trim() || !newStudyTypeTemplate.trim()) {
      setStatus('❌ Please provide both study type name and template')
      return
    }

    if (allStudyTypes.includes(newStudyTypeName)) {
      setStatus('❌ Study type already exists')
      return
    }

    try {
      // Import the default agent logic
      const { createDefaultAgentLogic } = await import('../mocks/defaultAgentLogic')
      const defaultLogic = createDefaultAgentLogic(newStudyTypeName)
      
      // Process keywords - split by comma and clean up
      const keywordsList = newStudyTypeKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      if (onSaveWithAgentLogic) {
        // Use the new function that includes agent logic and keywords
        await onSaveWithAgentLogic(newStudyTypeName, newStudyTypeTemplate, defaultLogic, true, keywordsList)
      } else {
        // Fallback to the old function (without keywords for now)
        await onSave(newStudyTypeName, newStudyTypeTemplate, '', '', true)
      }

      // Reset form and close modal
      setNewStudyTypeName('')
      setNewStudyTypeTemplate('')
      setNewStudyTypeKeywords('')
      setShowAddNew(false)
      setSelected(newStudyTypeName)
      setStatus(`✅ Created "${newStudyTypeName}" with default agent logic`)
      
      // Clear status after 3 seconds
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to create new study type')
    }
  }

  const handleCancelAddNew = () => {
    setNewStudyTypeName('')
    setNewStudyTypeTemplate('')
    setNewStudyTypeKeywords('')
    setShowAddNew(false)
    setStatus(null)
  }

  const handleDelete = async () => {
    if (!selected || !templates[selected]) {
      setStatus('❌ Cannot delete - template not found')
      setShowDeleteConfirm(false)
      return
    }

    // Don't allow deletion of base study types that ship with the app
    if (baseStudyTypes.includes(selected)) {
      setStatus('❌ Cannot delete built-in study types')
      setShowDeleteConfirm(false)
      return
    }

    try {
      if (onDelete) {
        await onDelete(selected)
        setStatus(`✅ Deleted "${selected}"`)
        // Select first available study type after deletion
        const remainingTypes = allStudyTypes.filter(t => t !== selected)
        if (remainingTypes.length > 0) {
          setSelected(remainingTypes[0])
        }
      }
      setShowDeleteConfirm(false)
      // Clear status after 3 seconds
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      console.error(err)
      setStatus('❌ Failed to delete template')
      setShowDeleteConfirm(false)
    }
  }

  // Get current values - prefer edits over saved templates
  const current = templates[selected] || {}
  const currentEdit = edits[selected] || {}
  const currentValues = {
    template: currentEdit.template ?? current.template ?? '',
    showDiffView: currentEdit.showDiffView ?? current.showDiffView ?? true,
    keywords: currentEdit.keywords ?? current.keywords ?? []
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, width: '90%', margin: '20px auto 0 auto', paddingLeft: 20, paddingRight: 20 }}>
      <p style={{ fontSize: 12, marginBottom: 8, color: '#fff' }}>
  Loaded {templates ? Object.keys(templates).length : 0} templates{isOfflineMode ? ' (Offline Mode)' : ''}.
</p>


      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <BlurCard>
            <button 
              className="radpal-button radpal-button-impression" 
              onClick={() => setShowAddNew(true)} 
              style={{ border: 'none', backgroundColor: '#2a9b7a' }}
            > 
              + Add New 
            </button>
          </BlurCard>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Delete button - only show for custom templates */}
          {selected && templates[selected] && !baseStudyTypes.includes(selected) && (
            <BlurCard>
              <button 
                className="radpal-button radpal-button-remove" 
                onClick={() => setShowDeleteConfirm(true)}
                style={{ border: 'none', backgroundColor: '#dc2626' }}
              > 
                Delete 
              </button>
            </BlurCard>
          )}
          <BlurCard>
            <button className="radpal-button radpal-button-impression" onClick={handleSave} style={{ border: 'none' }}> Save </button>
          </BlurCard>
          {status && <span style={{ fontSize: 13, color: '#fff' }}>{status}</span>}
        </div>
      </div>

    <label
  style={{
    fontSize: '15px',
    fontWeight: 400,
    marginBottom: 6,
    display: 'block',
    color: '#fff'
  }}
>
  Select Study Type:
</label>

<BlurCard>
  <select
    value={selected}
    onChange={(e) => {
      saveCurrentEdits()
      setSelected(e.target.value)
    }}
    style={{
      width: '100%',
      fontSize: '16px',
      padding: '12px 16px',
      borderRadius: 12,
      backgroundColor: 'transparent',
      color: '#fff',
      border: 'none',
      outline: 'none',
      fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: 500,
      /* cursor removed */
    }}
  >
    {allStudyTypes.map(type => (
      <option
        key={type}
        value={type}
        style={{ 
          fontSize: '16px', 
          backgroundColor: '#1a1d23', 
          color: '#fff',
          padding: '8px 12px',
          fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400
        }}
      >
        {type}
      </option>
    ))}
  </select>
</BlurCard>

      <div style={{ marginBottom: 16 }}></div>

      <BlurCard>
        <textarea
          ref={templateRef}
          value={currentValues.template}
          onChange={(e) => {
            setEdits(prev => ({
              ...prev,
              [selected]: {
                template: e.target.value
              }
            }))
          }}
          style={{ 
            width: '100%', 
            height: 700, 
            marginBottom: 30, 
            fontSize: '16px',
            fontFamily: "'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
            backgroundColor: 'transparent',
            color: '#fff',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }}
        />
      </BlurCard>

      {/* Keywords Editor */}
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <label style={{ 
          fontSize: '14px',
          fontWeight: 400,
          marginBottom: 8,
          display: 'block',
          color: '#fff'
        }}>
          Keywords (comma-separated, for template suggestions):
        </label>
        <BlurCard>
          <textarea
            value={edits[selected]?.keywordsRaw !== undefined 
              ? edits[selected].keywordsRaw
              : edits[selected]?.keywords !== undefined 
                ? edits[selected].keywords.join(', ')
                : currentValues.keywords.join(', ')}
            onChange={(e) => {
              // Store the raw text, don't process it on every keystroke
              const rawText = e.target.value
              
              setEdits(prev => ({
                ...prev,
                [selected]: {
                  ...prev[selected],
                  template: templateRef.current?.value ?? currentValues.template,
                  keywordsRaw: rawText,
                  // Only split into array when we actually save or blur
                  keywords: prev[selected]?.keywords ?? currentValues.keywords
                }
              }))
            }}
            onBlur={(e) => {
              // Process the keywords on blur (when user finishes typing)
              const rawText = e.target.value
              const keywordsArray = rawText
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0)
              
              setEdits(prev => ({
                ...prev,
                [selected]: {
                  ...prev[selected],
                  template: templateRef.current?.value ?? currentValues.template,
                  keywords: keywordsArray,
                  keywordsRaw: undefined // Clear the raw text
                }
              }))
            }}
            placeholder="e.g., knee, meniscus, acl, patella"
            style={{ 
              width: '100%', 
              height: 80, 
              fontSize: '14px',
              fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              padding: '12px 16px'
            }}
          />
        </BlurCard>
        <p style={{ 
          fontSize: '12px',
          color: '#999',
          marginTop: 8
        }}>
          Enter keywords separated by commas. Press Tab or click outside to format.
        </p>
      </div>

      {/* Diff View Toggle */}
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <BlurCard>
          <div style={{ 
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <label style={{ 
              fontSize: '14px', 
              fontWeight: 400, 
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={currentValues.showDiffView}
                onChange={(e) => {
                  setEdits(prev => ({
                    ...prev,
                    [selected]: {
                      ...prev[selected],
                      template: templateRef.current?.value ?? currentValues.template,
                      showDiffView: e.target.checked
                    }
                  }))
                }}
                style={{ 
                  marginRight: 8,
                  width: 16,
                  height: 16,
                  cursor: 'pointer'
                }}
              />
              Show Diff View When Generating Report
            </label>
            <span style={{ 
              fontSize: '12px', 
              color: '#999',
              marginLeft: 16
            }}>
              {currentValues.showDiffView ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </BlurCard>
      </div>

      {/* Add New Study Type Modal */}
      {showAddNew && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <BlurCard style={{ width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ padding: 20 }}>
              <h3 style={{ color: '#fff', marginBottom: 20, fontSize: 18 }}>Add New Study Type</h3>
              
              <label style={{ fontSize: '14px', fontWeight: 400, marginBottom: 6, display: 'block', color: '#fff' }}>
                Study Type Name:
              </label>
              <input
                ref={newStudyTypeNameRef}
                type="text"
                value={newStudyTypeName}
                onChange={(e) => setNewStudyTypeName(e.target.value)}
                placeholder="e.g., MRI Brain, CT Abdomen"
                style={{
                  width: '100%',
                  fontSize: '16px',
                  padding: '12px 16px',
                  marginBottom: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  outline: 'none',
                  fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              />

              <label style={{ fontSize: '14px', fontWeight: 400, marginBottom: 6, display: 'block', color: '#fff' }}>
                Template Structure:
              </label>
              <textarea
                ref={newStudyTypeTemplateRef}
                value={newStudyTypeTemplate}
                onChange={(e) => setNewStudyTypeTemplate(e.target.value)}
                placeholder={`FINDINGS:\n[Describe findings here]\n\nIMPRESSION:\n[Summary of findings]`}
                style={{
                  width: '100%',
                  height: 200,
                  fontSize: '14px',
                  padding: '12px 16px',
                  marginBottom: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: "'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
                }}
              />

              <label style={{ fontSize: '14px', fontWeight: 400, marginBottom: 6, display: 'block', color: '#fff' }}>
                Detection Keywords (Optional):
              </label>
              <textarea
                value={newStudyTypeKeywords}
                onChange={(e) => setNewStudyTypeKeywords(e.target.value)}
                placeholder="Enter keywords separated by commas that will help identify this study type&#10;e.g., femoral head, acetabulum, labral tear, cam lesion"
                style={{
                  width: '100%',
                  height: 100,
                  fontSize: '14px',
                  padding: '12px 16px',
                  marginBottom: 10,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              />
              <p style={{ fontSize: 11, color: '#888', marginBottom: 20 }}>
                These keywords will help the auto-suggestion feature identify when to suggest this study type based on the dictated findings.
              </p>

              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>
                A default agent logic will be created automatically. You can customize it later using "Edit Logic".
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancelAddNew}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewStudyType}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 12,
                    backgroundColor: '#3ABC96',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Create Study Type
                </button>
              </div>
            </div>
          </BlurCard>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <BlurCard style={{ width: '90%', maxWidth: 400 }}>
            <div style={{ padding: 20 }}>
              <h3 style={{ color: '#fff', marginBottom: 20, fontSize: 18 }}>Confirm Deletion</h3>
              
              <p style={{ color: '#fff', marginBottom: 20, fontSize: 14 }}>
                Are you sure you want to delete the template for "{selected}"? This action cannot be undone.
              </p>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#374151',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Delete Template
                </button>
              </div>
            </div>
          </BlurCard>
        </div>
      )}

      
    </div>
  )
}
