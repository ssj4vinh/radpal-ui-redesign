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
  }>
  onSave: (studyType: string, template: string, generatePrompt: string, generateImpression?: string) => void
}

export default function LogicManager({ templates, onSave }: Props) {
  // Combine base study types with ones from templates
  const allStudyTypes = [...new Set([...baseStudyTypes, ...Object.keys(templates)])]
  
  const [selected, setSelected] = useState(allStudyTypes[0] || '')
  const [status, setStatus] = useState<string | null>(null)
  
  // Track edits for each template separately
  const [edits, setEdits] = useState<Record<string, {
    generate_prompt: string
    generate_impression: string
  }>>({})

  const promptRef = useRef<HTMLTextAreaElement>(null)
  const impressionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Default to the first item in the dropdown list (allStudyTypes)
    if (allStudyTypes.length > 0 && !allStudyTypes.includes(selected)) {
      setSelected(allStudyTypes[0]) // Default to the first study type if current selection is invalid
    }
  }, [templates, allStudyTypes, selected])

  // Save current edits before switching templates
  const saveCurrentEdits = () => {
    if (promptRef.current && impressionRef.current) {
      setEdits(prev => ({
        ...prev,
        [selected]: {
          generate_prompt: promptRef.current!.value,
          generate_impression: impressionRef.current!.value
        }
      }))
    }
  }

  // When templates change, update our local edits to match
  useEffect(() => {
    setEdits(prevEdits => {
      const newEdits = { ...prevEdits }
      
      // Update edits only if templates actually changed
      let hasChanges = false
      Object.keys(templates).forEach(studyType => {
        const template = templates[studyType]
        const existingEdit = prevEdits[studyType]
        
        // Only update if we don't have local edits or if the template values are different
        if (!existingEdit || 
            (existingEdit.generate_prompt !== template.generate_prompt) ||
            (existingEdit.generate_impression !== (template.generate_impression || ''))) {
          newEdits[studyType] = {
            generate_prompt: template.generate_prompt || '',
            generate_impression: template.generate_impression || ''
          }
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
        current.template ?? '', // Keep existing template unchanged
        currentEdit.generate_prompt ?? promptRef.current?.value ?? current.generate_prompt ?? '',
        currentEdit.generate_impression ?? impressionRef.current?.value ?? current.generate_impression ?? ''
      )
      
      // Don't clear edits immediately - let them persist until templates prop updates
      // This prevents the UI from reverting to old values
      
      // No status message shown on successful save
    } catch (err) {
      console.error(err)
      setStatus('❌ Save failed')
    }
  }

  // Get current values - prefer edits over saved templates
  const current = templates[selected] || {}
  const currentEdit = edits[selected] || {}
  const currentValues = {
    generate_prompt: currentEdit.generate_prompt ?? current.generate_prompt ?? '',
    generate_impression: currentEdit.generate_impression ?? current.generate_impression ?? ''
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, width: '90%', margin: '20px auto 0 auto', paddingLeft: 20, paddingRight: 20 }}>
      <p style={{ fontSize: 12, marginBottom: 8, color: '#fff' }}>
        Loaded {templates ? Object.keys(templates).length : 0} templates.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 16 }}>
        <BlurCard>
          <button className="radpal-button radpal-button-impression" onClick={handleSave} style={{ border: 'none' }}> Save </button>
        </BlurCard>
        {status && <span style={{ fontSize: 13, color: '#fff' }}>{status}</span>}
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
                fontWeight: 500
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
          ref={promptRef}
          value={currentValues.generate_prompt}
          onChange={(e) => {
            setEdits(prev => ({
              ...prev,
              [selected]: {
                ...prev[selected],
                generate_prompt: e.target.value,
                generate_impression: prev[selected]?.generate_impression ?? currentValues.generate_impression
              }
            }))
          }}
          style={{ 
            width: '100%', 
            height: 600, 
            marginBottom: 12, 
            fontSize: '16px',
            fontFamily: "'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
            backgroundColor: 'transparent',
            color: '#fff',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }}
          placeholder="Report Logic"
        />
      </BlurCard>

      <div style={{ marginBottom: 16 }}></div>

      <BlurCard>
        <textarea
          ref={impressionRef}
          value={currentValues.generate_impression}
          onChange={(e) => {
            setEdits(prev => ({
              ...prev,
              [selected]: {
                ...prev[selected],
                generate_prompt: prev[selected]?.generate_prompt ?? currentValues.generate_prompt,
                generate_impression: e.target.value
              }
            }))
          }}
          style={{ 
            width: '100%', 
            height: 600, 
            marginBottom: 12, 
            fontSize: '16px',
            fontFamily: "'JetBrains Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
            backgroundColor: 'transparent',
            color: '#fff',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }}
          placeholder="Impression Logic"
        />
      </BlurCard>
    </div>
  )
}