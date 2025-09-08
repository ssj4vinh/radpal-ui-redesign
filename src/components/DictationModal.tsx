// PATCH for DictationModal.tsx (adds "Other" with custom input)

import React, { useState, useEffect } from 'react'
import BlurCard from './BlurCard'

interface DictationModalProps {
  visible: boolean
  selected: string
  onSelect: (value: string) => void
  onClose: () => void
  onCancel?: () => void
}

const DictationModal: React.FC<DictationModalProps> = ({ visible, selected, onSelect, onClose, onCancel }) => {
  const [customValue, setCustomValue] = useState('')
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (selected !== 'Other') {
      setCustomValue('')
    } else {
      const saved = localStorage.getItem('customDictationWindow') || ''
      setCustomValue(saved)
    }
  }, [selected])

  const handleConfirm = () => {
    if (selected === 'Other' && customValue.trim()) {
      localStorage.setItem('customDictationWindow', customValue.trim())
      window?.electron?.ipcRenderer?.invoke('set-custom-window-name', customValue.trim())
    }
    onClose()
  }

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <BlurCard style={{ padding: 24, minWidth: 300, maxWidth: 400, color: 'white', backgroundColor: 'rgba(42, 45, 49, 0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, border: 'none' }}>
        <h2 style={{ marginTop: 0, fontFamily: 'SF Pro, system-ui, sans-serif', fontWeight: 400 }}>Select Dictation Software</h2>
        <BlurCard style={{ marginBottom: 16 }}>
          <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              fontSize: '16px',
              fontFamily: 'SF Pro, system-ui, sans-serif',
              fontWeight: 400, 
              borderRadius: 16, 
              backgroundColor: 'transparent', 
              color: 'white', 
              border: 'none', 
              outline: 'none'
            }}
          >
            <option value="PowerScribe" style={{ backgroundColor: '#1a1d23', color: 'white' }}>PowerScribe</option>
            <option value="Fluency" style={{ backgroundColor: '#1a1d23', color: 'white' }}>Fluency</option>
            <option value="Dragon" style={{ backgroundColor: '#1a1d23', color: 'white' }}>Dragon</option>
            <option value="Other" style={{ backgroundColor: '#1a1d23', color: 'white' }}>Other</option>
          </select>
        </BlurCard>



        {selected === 'Other' && (
          <BlurCard style={{ marginBottom: 16, padding: 8 }}>
            <input
              type="text"
              value={customValue}
              placeholder="Enter window title of your dictation software"
              onChange={(e) => setCustomValue(e.target.value)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '11px',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 400,
                borderRadius: 16,
                backgroundColor: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                marginBottom: 4
              }}
            />
            {showTooltip && (
              <div style={{ fontSize: 12, color: '#fff', fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>
                (Case sensitive. Only partial matching required. e.g. "Dragon" for Dragon Medical One)
              </div>
            )}
          </BlurCard>
        )}


        <div style={{ textAlign: 'right', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <BlurCard
            onClick={() => {
              if (onCancel) onCancel();
            }}
            style={{ 
              color: 'white', 
              padding: '8px 16px', 
              /* cursor removed */
              backgroundColor: 'rgba(108, 117, 125, 0.3)'
            }}
          >
            Cancel
          </BlurCard>
          <BlurCard
            onClick={handleConfirm}
            style={{ 
              color: 'white', 
              padding: '8px 16px', 
              /* cursor removed */
              backgroundColor: '#3b82f6'
            }}
          >
            Confirm
          </BlurCard>
        </div>
      </BlurCard>
    </div>
  )
}

export default DictationModal