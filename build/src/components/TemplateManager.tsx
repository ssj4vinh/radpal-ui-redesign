
import React, { useState, useEffect, useRef } from 'react'
import BlurCard from './BlurCard'

// Base study types that are always available
const baseStudyTypes = [
  'MRI Ankle', 'MRI Foot', 'MRI Knee', 'MRI Hip',
  'MRI Shoulder', 'MRI Elbow', 'MRI Wrist', 'MRI Hand',
  'MRI Cervical Spine', 'MRI Thoracic Spine', 'MRI Lumbar Spine', 'MRI Total Spine',
  'DEXA', 'CT Generic', 'MRI Generic', 'CT Abdomen Pelvis', 'CT Pulmonary Embolism', 'CT Chest', 'CT Head', 'Knee Test Template'
]

interface Props {
  templates: Record<string, {
    template: string
    generate_prompt: string
    generate_impression?: string
    showDiffView?: boolean
  }>
  onSave: (studyType: string, template: string, generatePrompt: string, generateImpression?: string, showDiffView?: boolean) => void
  onSaveWithAgentLogic?: (studyType: string, template: string, agentLogic: Record<string, any>, showDiffView?: boolean) => void
  isOfflineMode?: boolean
}

export default function TemplateManager({ templates, onSave, onSaveWithAgentLogic, isOfflineMode }: Props) {
  // Combine base study types with ones from templates
  const allStudyTypes = [...new Set([...baseStudyTypes, ...Object.keys(templates)])]
  
  const [selected, setSelected] = useState(allStudyTypes[0] || '')
  const [status, setStatus] = useState<string | null>(null)
  const [showAddNew, setShowAddNew] = useState(false)
  const [newStudyTypeName, setNewStudyTypeName] = useState('')
  const [newStudyTypeTemplate, setNewStudyTypeTemplate] = useState('')
  
  // Track edits for each template separately
  const [edits, setEdits] = useState<Record<string, {
    template: string
    showDiffView?: boolean
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
      
      await onSave(
        selected,
        currentEdit.template ?? templateRef.current?.value ?? current.template ?? '',
        current.generate_prompt ?? '',
        current.generate_impression ?? '',
        currentEdit.showDiffView ?? current.showDiffView ?? true
      )
      
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
      const { createDefaultAgentLogic } = await import('../../agent/defaultAgentLogic')
      const defaultLogic = createDefaultAgentLogic(newStudyTypeName)

      if (onSaveWithAgentLogic) {
        // Use the new function that includes agent logic
        await onSaveWithAgentLogic(newStudyTypeName, newStudyTypeTemplate, defaultLogic, true)
      } else {
        // Fallback to the old function
        await onSave(newStudyTypeName, newStudyTypeTemplate, '', '', true)
      }

      // Reset form and close modal
      setNewStudyTypeName('')
      setNewStudyTypeTemplate('')
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
    setShowAddNew(false)
    setStatus(null)
  }

  // Get current values - prefer edits over saved templates
  const current = templates[selected] || {}
  const currentEdit = edits[selected] || {}
  const currentValues = {
    template: currentEdit.template ?? current.template ?? '',
    showDiffView: currentEdit.showDiffView ?? current.showDiffView ?? true
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
                  height: 300,
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

      
    </div>
  )
}
