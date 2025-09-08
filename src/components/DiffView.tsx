import React from 'react'
import { diffWordsWithSpace } from 'diff'

interface DiffViewProps {
  originalText: string
  newText: string
  theme?: string
  style?: React.CSSProperties
}

const DiffView: React.FC<DiffViewProps> = ({ originalText, newText, theme, style }) => {
  // Calculate diff parts
  const diffParts = React.useMemo(() => {
    if (!originalText && !newText) return []
    return diffWordsWithSpace(originalText || '', newText || '')
  }, [originalText, newText])

  // Handle copy event to clean text
  const handleCopy = (e: React.ClipboardEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    let selectedText = selection.toString()
    
    // Remove zero-width spaces and other invisible Unicode characters
    selectedText = selectedText
      .replace(/\u200B/g, '') // Zero-width space
      .replace(/\u200C/g, '') // Zero-width non-joiner
      .replace(/\u200D/g, '') // Zero-width joiner
      .replace(/\uFEFF/g, '') // Zero-width non-breaking space
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
      .replace(/[\u2000-\u200A]/g, ' ') // Replace various Unicode spaces with regular spaces
    
    // Set the cleaned text to clipboard
    e.clipboardData.setData('text/plain', selectedText)
    e.preventDefault()
  }

  return (
    <div
      onCopy={handleCopy}
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        fontSize: 14,
        lineHeight: 1.6,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: theme === 'light' ? '#000000' : '#e0e0e0',
        backgroundColor: 'transparent',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style
      }}
    >
      {diffParts.map((part, index) => {
        // Format the text with proper line breaks and keywords
        let formattedText = part.value
        
        // Preserve newlines
        const lines = formattedText.split('\n')
        
        return lines.map((line, lineIndex) => (
          <React.Fragment key={`${index}-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {line && (
              part.added ? (
                <span
                  style={{
                    backgroundColor: 'rgba(58, 188, 150, 0.3)',
                    color: '#3ABC96',
                    padding: '1px 2px',
                    borderRadius: '2px',
                    fontWeight: 500
                  }}
                >
                  {formatKeywords(line)}
                </span>
              ) : part.removed ? (
                <span
                  style={{
                    backgroundColor: 'rgba(227, 103, 86, 0.3)',
                    color: '#E36756',
                    textDecoration: 'line-through',
                    padding: '1px 2px',
                    borderRadius: '2px',
                    opacity: 0.7
                  }}
                >
                  {formatKeywords(line)}
                </span>
              ) : (
                <span>{formatKeywords(line)}</span>
              )
            )}
          </React.Fragment>
        ))
      })}
    </div>
  )
}

// Helper function to format keywords
function formatKeywords(text: string): React.ReactNode {
  // Split by keywords while keeping them
  const parts = text.split(/(\b(?:FINDINGS?:|IMPRESSION:|COMPARISON:|RECOMMENDATION:|LEFT|RIGHT)\b)/gi)
  
  return parts.map((part, index) => {
    if (/^(FINDINGS?:|IMPRESSION:|COMPARISON:|RECOMMENDATION:|LEFT|RIGHT)$/i.test(part)) {
      return <strong key={index}>{part}</strong>
    }
    return part
  })
}

export default DiffView