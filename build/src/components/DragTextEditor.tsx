import React, { useState, useEffect, useRef, useCallback } from 'react'

interface ImpressionItem {
  id: string
  content: string
  originalIndex: number
}

interface DragTextEditorProps {
  text: string
  onChange: (newText: string) => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  onMouseUp?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
}

export default function DragTextEditor({ 
  text, 
  onChange, 
  disabled, 
  className, 
  style, 
  onMouseUp 
}: DragTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [impressionItems, setImpressionItems] = useState<ImpressionItem[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<string | null>(null)
  
  // Text dragging state
  const [isDragMode, setIsDragMode] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [selectionStart, setSelectionStart] = useState(0)
  const [selectionEnd, setSelectionEnd] = useState(0)
  const [dragPreview, setDragPreview] = useState<{ x: number, y: number, text: string } | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ position: number, visible: boolean }>({ position: 0, visible: false })
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false)
  const [showDeleteZone, setShowDeleteZone] = useState(false)

  // Parse impression items for the reorder mode
  const parseImpressionItems = useCallback((inputText: string): { items: ImpressionItem[], hasImpression: boolean } => {
    const impressionMatch = inputText.match(/IMPRESSION:?\s*([\s\S]*?)(?:\n\n[A-Z]+:|$)/i)
    if (!impressionMatch) {
      return { items: [], hasImpression: false }
    }

    const impressionText = impressionMatch[1].trim()
    const items: ImpressionItem[] = []

    // Parse numbered items
    const numberedMatches = [...impressionText.matchAll(/^(\d+)\.\s*(.*?)(?=\n\d+\.\s|\n\n|$)/gms)]
    if (numberedMatches.length > 0) {
      numberedMatches.forEach((match, index) => {
        items.push({
          id: `item-${index}`,
          content: match[2].trim().replace(/\n\s*\n/g, '\n'),
          originalIndex: index
        })
      })
      return { items, hasImpression: true }
    }

    // Parse bullet points
    const bulletMatches = [...impressionText.matchAll(/^[•\-\*]\s*(.*?)(?=\n[•\-\*]\s|\n\n|$)/gms)]
    if (bulletMatches.length > 0) {
      bulletMatches.forEach((match, index) => {
        items.push({
          id: `item-${index}`,
          content: match[1].trim().replace(/\n\s*\n/g, '\n'),
          originalIndex: index
        })
      })
      return { items, hasImpression: true }
    }

    // Parse paragraphs
    const paragraphs = impressionText.split(/\n\s*\n+/).filter(p => p.trim())
    if (paragraphs.length > 1) {
      paragraphs.forEach((paragraph, index) => {
        items.push({
          id: `item-${index}`,
          content: paragraph.trim(),
          originalIndex: index
        })
      })
      return { items, hasImpression: true }
    }

    return { items: [], hasImpression: true }
  }, [])

  // Update impression items when text changes
  useEffect(() => {
    const { items } = parseImpressionItems(text)
    setImpressionItems(items)
  }, [text, parseImpressionItems])

  // Handle text selection for dragging
  const handleTextSelection = useCallback(() => {
    if (!textareaRef.current || disabled) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    if (start !== end) {
      const selected = text.substring(start, end)
      setSelectedText(selected)
      setSelectionStart(start)
      setSelectionEnd(end)
    } else {
      setSelectedText('')
    }
  }, [text, disabled])

  // Handle mouse down for potential text dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (disabled || !selectedText) return
    
    // Check if clicking on selected text
    const textarea = textareaRef.current!
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    if (start < selectionEnd && end > selectionStart) {
      // Starting drag on selected text
      setIsDragMode(true)
      setShowDeleteZone(true)
      setDragPreview({ x: e.clientX, y: e.clientY, text: selectedText })
      e.preventDefault()
    }
  }, [disabled, selectedText, selectionStart, selectionEnd])

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!isDragMode || !textareaRef.current) return

    // Update drag preview position
    setDragPreview(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)

    const textarea = textareaRef.current
    const rect = textarea.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if mouse is outside textarea bounds (for delete zone)
    const isOutside = x < 0 || x > rect.width || y < 0 || y > rect.height
    
    if (isOutside) {
      // Show delete zone when dragging outside
      setIsOverDeleteZone(true)
      setDropIndicator({ position: 0, visible: false })
      return
    }

    setIsOverDeleteZone(false)

    // Calculate drop position when inside textarea
    const lineHeight = 20 // Approximate
    const charWidth = 7.5 // Approximate
    const scrollTop = textarea.scrollTop
    const scrollLeft = textarea.scrollLeft

    const line = Math.floor((y + scrollTop) / lineHeight)
    const char = Math.floor((x + scrollLeft) / charWidth)

    // Convert to text position
    const lines = text.split('\n')
    let position = 0
    for (let i = 0; i < line && i < lines.length; i++) {
      position += lines[i].length + 1 // +1 for newline
    }
    position += Math.min(char, lines[line]?.length || 0)
    position = Math.max(0, Math.min(position, text.length))

    // Don't show drop indicator if dropping in the original selection
    if (position < selectionStart || position > selectionEnd) {
      setDropIndicator({ position, visible: true })
    } else {
      setDropIndicator({ position: 0, visible: false })
    }
  }, [isDragMode, text, selectionStart, selectionEnd])

  // Handle mouse up to complete drag
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (isDragMode) {
      if (isOverDeleteZone) {
        // Delete the selected text
        const beforeSelection = text.substring(0, selectionStart)
        const afterSelection = text.substring(selectionEnd)
        const newText = beforeSelection + afterSelection
        
        onChange(newText)
        
        // Position cursor where the deleted text was
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(selectionStart, selectionStart)
            textareaRef.current.focus()
          }
        }, 0)
      } else if (dropIndicator.visible) {
        // Perform the text move
        let newText: string
        if (dropIndicator.position < selectionStart) {
          // Dropping before the original selection
          const beforeSelection = text.substring(0, selectionStart)
          const afterSelection = text.substring(selectionEnd)
          newText = text.substring(0, dropIndicator.position) + selectedText + 
                   text.substring(dropIndicator.position, selectionStart) + afterSelection
        } else {
          // Dropping after the original selection
          const beforeSelection = text.substring(0, selectionStart)
          const afterSelection = text.substring(selectionEnd)
          newText = beforeSelection + text.substring(selectionEnd, dropIndicator.position) + 
                   selectedText + text.substring(dropIndicator.position)
        }
        
        onChange(newText)
        
        // Update cursor position to the dropped text
        setTimeout(() => {
          if (textareaRef.current) {
            const newSelectionStart = dropIndicator.position < selectionStart ? 
              dropIndicator.position : 
              dropIndicator.position - (selectionEnd - selectionStart)
            textareaRef.current.setSelectionRange(newSelectionStart, newSelectionStart + selectedText.length)
          }
        }, 0)
      }
    }

    // Reset drag state
    setIsDragMode(false)
    setDragPreview(null)
    setDropIndicator({ position: 0, visible: false })
    setIsOverDeleteZone(false)
    setShowDeleteZone(false)

    // Call original onMouseUp if provided
    if (onMouseUp) {
      onMouseUp(e)
    }
  }, [isDragMode, isOverDeleteZone, dropIndicator, text, selectedText, selectionStart, selectionEnd, onChange, onMouseUp])

  // Impression reorder functions (existing functionality)
  const reconstructReport = useCallback((reorderedItems: ImpressionItem[]) => {
    if (reorderedItems.length === 0) return text

    const impressionMatch = text.match(/IMPRESSION:?\s*([\s\S]*?)(?:\n\n[A-Z]+:|$)/i)
    if (!impressionMatch) return text

    const beforeImpression = text.substring(0, impressionMatch.index!)
    const afterImpression = text.substring(impressionMatch.index! + impressionMatch[0].length)
    
    const originalImpressionText = impressionMatch[1].trim()
    const isNumbered = /^\d+\./.test(originalImpressionText)
    const isBulleted = /^[•\-\*]/.test(originalImpressionText)

    let newImpressionText = ''
    if (isNumbered) {
      newImpressionText = reorderedItems.map((item, index) => `${index + 1}. ${item.content}`).join('\n\n')
    } else if (isBulleted) {
      newImpressionText = reorderedItems.map(item => `• ${item.content}`).join('\n\n')
    } else {
      newImpressionText = reorderedItems.map(item => item.content).join('\n\n')
    }

    const impressionHeader = impressionMatch[0].match(/IMPRESSION:?\s*/i)?.[0] || 'IMPRESSION:\n'
    return beforeImpression + impressionHeader + newImpressionText + (afterImpression ? '\n\n' + afterImpression : '')
  }, [text])

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const newItems = [...impressionItems]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)

    setImpressionItems(newItems)
    const newText = reconstructReport(newItems)
    onChange(newText)
  }, [impressionItems, reconstructReport, onChange])

  const handleImpressionDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleImpressionDragOver = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverItem(itemId)
  }

  const handleImpressionDrop = (e: React.DragEvent<HTMLDivElement>, targetItemId: string) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const fromIndex = impressionItems.findIndex(item => item.id === draggedItem)
    const toIndex = impressionItems.findIndex(item => item.id === targetItemId)

    handleReorder(fromIndex, toIndex)
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const moveUp = (index: number) => {
    if (index > 0) handleReorder(index, index - 1)
  }

  const moveDown = (index: number) => {
    if (index < impressionItems.length - 1) handleReorder(index, index + 1)
  }

  const { hasImpression } = parseImpressionItems(text)

  // Impression reorder mode
  if (isReorderMode && impressionItems.length > 0) {
    return (
      <div style={{ position: 'relative', ...style }}>
        <div style={{
          background: 'rgba(58, 188, 150, 0.1)',
          border: '1px solid rgba(58, 188, 150, 0.3)',
          borderRadius: '8px 8px 0 0',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#3ABC96', fontSize: '12px', fontWeight: 500 }}>
            Reorder Impression Items
          </span>
          <button
            onClick={() => setIsReorderMode(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3ABC96',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Done
          </button>
        </div>

        <div style={{
          background: style?.backgroundColor || 'transparent',
          border: '1px solid rgba(58, 188, 150, 0.3)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '12px',
          height: (style?.height as string)?.replace('px', '') ? 
            `calc(${style.height} - 40px)` : '360px',
          overflowY: 'auto'
        }}>
          {impressionItems.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleImpressionDragStart(e, item.id)}
              onDragOver={(e) => handleImpressionDragOver(e, item.id)}
              onDrop={(e) => handleImpressionDrop(e, item.id)}
              style={{
                backgroundColor: dragOverItem === item.id ? 
                  'rgba(58, 188, 150, 0.2)' : 
                  draggedItem === item.id ? 
                    'rgba(58, 188, 150, 0.15)' : 
                    'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${dragOverItem === item.id || draggedItem === item.id ? 
                  'rgba(58, 188, 150, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                padding: '12px',
                marginBottom: '8px',
                cursor: draggedItem === item.id ? 'grabbing' : 'grab',
                opacity: draggedItem === item.id ? 0.7 : 1,
                transition: 'all 0.2s ease',
                color: '#fff',
                fontSize: '13px',
                lineHeight: '1.4'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  minWidth: '20px',
                  height: '20px',
                  backgroundColor: 'rgba(58, 188, 150, 0.2)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#3ABC96',
                  fontWeight: 600
                }}>
                  {index + 1}
                </div>
                <div style={{ flex: 1 }}>{item.content}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button onClick={() => moveUp(index)} disabled={index === 0} style={{
                    background: index === 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(58, 188, 150, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    color: index === 0 ? '#666' : '#3ABC96',
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    fontSize: '10px'
                  }}>↑</button>
                  <button onClick={() => moveDown(index)} disabled={index === impressionItems.length - 1} style={{
                    background: index === impressionItems.length - 1 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(58, 188, 150, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    color: index === impressionItems.length - 1 ? '#666' : '#3ABC96',
                    cursor: index === impressionItems.length - 1 ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    fontSize: '10px'
                  }}>↓</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Regular textarea with text dragging
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleTextSelection}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        disabled={disabled}
        className={className}
        style={{
          ...style,
          cursor: isDragMode ? 'grabbing' : selectedText ? 'grab' : 'text',
          userSelect: isDragMode ? 'none' : 'text',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
      />

      {/* Drag preview */}
      {dragPreview && (
        <div
          style={{
            position: 'fixed',
            top: dragPreview.y + 10,
            left: dragPreview.x + 10,
            background: isOverDeleteZone ? 'rgba(227, 103, 86, 0.9)' : 'rgba(58, 188, 150, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            maxWidth: '200px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'background 0.2s ease'
          }}
        >
          {isOverDeleteZone ? '🗑️ ' : ''}{dragPreview.text.length > 30 ? dragPreview.text.substring(0, 30) + '...' : dragPreview.text}
        </div>
      )}

      {/* Drop indicator */}
      {dropIndicator.visible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%', // This is approximate - would need better positioning
              left: '20px',
              width: '2px',
              height: '20px',
              background: '#3ABC96',
              borderRadius: '1px',
              boxShadow: '0 0 4px rgba(58, 188, 150, 0.5)'
            }}
          />
        </div>
      )}

      {/* Delete zone overlay */}
      {showDeleteZone && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          {/* Delete zone border highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: isOverDeleteZone ? '3px solid #E36756' : '3px dashed rgba(227, 103, 86, 0.5)',
              background: isOverDeleteZone ? 'rgba(227, 103, 86, 0.1)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
          />
          
          {/* Delete zone indicator */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: isOverDeleteZone ? '#E36756' : 'rgba(227, 103, 86, 0.8)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
              scale: isOverDeleteZone ? '1.1' : '1'
            }}
          >
            {isOverDeleteZone ? '🗑️ Release to Delete' : '🗑️ Drag here to delete'}
          </div>
        </div>
      )}

      {/* Control buttons */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
        {selectedText && !isDragMode && (
          <div style={{
            background: 'rgba(58, 188, 150, 0.2)',
            border: '1px solid rgba(58, 188, 150, 0.3)',
            borderRadius: '4px',
            color: '#3ABC96',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 500
          }}>
            Drag to move or delete
          </div>
        )}
        
        {hasImpression && impressionItems.length > 0 && (
          <button
            onClick={() => setIsReorderMode(true)}
            style={{
              background: 'rgba(58, 188, 150, 0.2)',
              border: '1px solid rgba(58, 188, 150, 0.3)',
              borderRadius: '4px',
              color: '#3ABC96',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: 500,
              zIndex: 11
            }}
            title="Reorder impression items"
          >
            ⋮⋮ Reorder
          </button>
        )}
      </div>
    </div>
  )
}