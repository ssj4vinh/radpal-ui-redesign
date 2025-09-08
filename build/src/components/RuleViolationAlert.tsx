import React from 'react'

interface RuleViolationAlertProps {
  violations: string[]
  warnings: string[]
  onClose: () => void
}

export default function RuleViolationAlert({ violations, warnings, onClose }: RuleViolationAlertProps) {
  if (!violations.length && !warnings.length) return null

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      maxWidth: '400px',
      backgroundColor: 'rgb(40, 44, 52)',
      border: violations.length > 0 ? '2px solid #E36756' : '2px solid #ff9500',
      borderRadius: 8,
      padding: '16px',
      zIndex: 20000,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h3 style={{ 
          margin: 0, 
          color: violations.length > 0 ? '#E36756' : '#ff9500',
          fontSize: 14,
          fontWeight: 600
        }}>
          {violations.length > 0 ? '🚨 Logic Rule Violations' : '⚠️ Logic Rule Warnings'}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#999',
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>
      
      {violations.length > 0 && (
        <div style={{ marginBottom: warnings.length > 0 ? 16 : 0 }}>
          <div style={{ color: '#E36756', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
            Critical Rule Violations:
          </div>
          {violations.map((violation, index) => (
            <div key={index} style={{
              color: '#fff',
              fontSize: 11,
              marginBottom: 6,
              padding: '4px 8px',
              backgroundColor: 'rgba(227, 103, 86, 0.1)',
              borderRadius: 4,
              borderLeft: '3px solid #E36756',
              lineHeight: 1.4
            }}>
              {violation}
            </div>
          ))}
        </div>
      )}
      
      {warnings.length > 0 && (
        <div>
          <div style={{ color: '#ff9500', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
            Potential Issues:
          </div>
          {warnings.map((warning, index) => (
            <div key={index} style={{
              color: '#fff',
              fontSize: 11,
              marginBottom: 6,
              padding: '4px 8px',
              backgroundColor: 'rgba(255, 149, 0, 0.1)',
              borderRadius: 4,
              borderLeft: '3px solid #ff9500',
              lineHeight: 1.4
            }}>
              {warning}
            </div>
          ))}
        </div>
      )}
      
      <div style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#999',
        fontSize: 10,
        lineHeight: 1.3
      }}>
        💡 <strong>Tip:</strong> Adjust your logic rules in the Logic Editor to improve compliance, or regenerate the report to try again.
      </div>
    </div>
  )
}