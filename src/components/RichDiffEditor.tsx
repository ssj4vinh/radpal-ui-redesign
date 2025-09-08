import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect, useState } from 'react'

export interface RichDiffEditorHandle {
  insertDictation: (text: string) => void
  getValue: () => string
  getPlainText: () => string
  setValue: (text: string) => void
  focus: () => void
  getElement: () => HTMLDivElement | null
  saveCursor: () => void
  setDiffParts: (parts: any[]) => void
}

interface RichDiffEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  className?: string
  theme?: string
  diffParts?: any[]
}

const RichDiffEditor = forwardRef<RichDiffEditorHandle, RichDiffEditorProps>(
  ({ value, onChange, placeholder, style, className, theme, diffParts: initialDiffParts }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const [savedSelection, setSavedSelection] = useState<{ start: number, end: number } | null>(null)
    const [diffParts, setDiffParts] = useState<any[]>(initialDiffParts || [])
    const isInternalChange = useRef(false)

    // Update diff parts when prop changes
    useEffect(() => {
      if (initialDiffParts) {
        setDiffParts(initialDiffParts)
      }
    }, [initialDiffParts])

    // Render content with diff highlighting
    const renderContent = useCallback((forceRender = false) => {
      if (!editorRef.current) return

      // Skip rendering if user is actively editing (unless forced)
      if (!forceRender && document.activeElement === editorRef.current) {
        return
      }

      // If we have diff parts, render them with proper styling
      if (diffParts && diffParts.length > 0) {
        const container = document.createElement('div')
        
        diffParts.forEach(part => {
          const span = document.createElement('span')
          span.textContent = part.value
          
          if (part.added) {
            // Green highlight for additions
            span.style.backgroundColor = 'rgba(64, 191, 128, 0.2)'
            span.style.color = theme === 'light' ? '#22863a' : '#85e89d'
            span.setAttribute('data-diff', 'added')
          } else if (part.removed) {
            // Red strikethrough for deletions
            span.style.textDecoration = 'line-through'
            span.style.color = theme === 'light' ? '#cb2431' : '#f97583'
            span.style.opacity = '0.7'
            span.setAttribute('data-diff', 'removed')
          } else {
            // Normal text
            span.setAttribute('data-diff', 'unchanged')
          }
          
          container.appendChild(span)
        })
        
        // Clear and set new content
        editorRef.current.innerHTML = ''
        while (container.firstChild) {
          editorRef.current.appendChild(container.firstChild)
        }
      } else {
        // No diff parts, just show plain text
        editorRef.current.textContent = value
      }
    }, [diffParts, theme, value])

    // Initial render and when diff parts change explicitly
    useEffect(() => {
      renderContent(true)
    }, [diffParts]) // Only re-render when diff parts change, not on every renderContent change

    // Get plain text without diff markup
    const getPlainText = useCallback(() => {
      if (!editorRef.current) return ''
      
      // If there are diff spans, process them
      const spans = editorRef.current.querySelectorAll('span[data-diff]')
      if (spans.length > 0) {
        let text = ''
        
        // Walk through all child nodes to preserve BR elements
        const walkNode = (node: Node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            
            // Check if it's a BR element
            if (element.tagName === 'BR') {
              text += '\n'
              return
            }
            
            // Check if it's a diff span
            if (element.hasAttribute('data-diff')) {
              const diffType = element.getAttribute('data-diff')
              if (diffType !== 'removed') {
                // Process children of non-removed spans
                Array.from(element.childNodes).forEach(walkNode)
              }
              return
            }
            
            // Process other elements
            Array.from(element.childNodes).forEach(walkNode)
          } else if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || ''
          }
        }
        
        Array.from(editorRef.current.childNodes).forEach(walkNode)
        return text
      }
      
      // No diff spans, use innerText which preserves line breaks
      return editorRef.current.innerText || ''
    }, [])

    // Get all text including removed parts
    const getValue = useCallback(() => {
      if (!editorRef.current) return ''
      return editorRef.current.textContent || ''
    }, [])

    // Save cursor position
    const saveCursorPosition = useCallback(() => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        setSavedSelection({
          start: range.startOffset,
          end: range.endOffset
        })
      }
    }, [])

    // Handle Enter key for proper line breaks
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          
          // Insert a line break
          const br = document.createElement('br')
          range.deleteContents()
          range.insertNode(br)
          
          // Create a text node after BR for cursor positioning
          const textNode = document.createTextNode('\u200B') // Zero-width space
          if (br.parentNode) {
            br.parentNode.insertBefore(textNode, br.nextSibling)
          }
          
          // Position cursor after the BR
          range.setStart(textNode, 0)
          range.setEnd(textNode, 0)
          selection.removeAllRanges()
          selection.addRange(range)
          
          // Update the content without triggering re-render
          if (editorRef.current) {
            const newValue = editorRef.current.innerText || ''
            onChange(newValue)
          }
        }
      }
    }, [onChange])

    // Handle input changes
    const handleInput = useCallback(() => {
      if (!editorRef.current || isInternalChange.current) return
      
      // Save cursor position before processing
      const selection = window.getSelection()
      let cursorOffset = 0
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const preCaretRange = range.cloneRange()
        preCaretRange.selectNodeContents(editorRef.current)
        preCaretRange.setEnd(range.endContainer, range.endOffset)
        cursorOffset = preCaretRange.toString().length
      }
      
      const newValue = editorRef.current.textContent || ''
      onChange(newValue)
      
      // DON'T clear diff parts - keep the visual highlights
      // User edits will be incorporated into the existing diff view
      
      // Restore cursor position after React re-render
      setTimeout(() => {
        if (!editorRef.current || !selection) return
        
        const textNode = editorRef.current.firstChild || editorRef.current
        const range = document.createRange()
        
        // Find the correct position in the new DOM structure
        let currentOffset = 0
        let targetNode: Node | null = null
        let targetOffset = 0
        
        const walkNodes = (node: Node): boolean => {
          if (currentOffset >= cursorOffset) return true
          
          if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent?.length || 0
            if (currentOffset + textLength >= cursorOffset) {
              targetNode = node
              targetOffset = cursorOffset - currentOffset
              return true
            }
            currentOffset += textLength
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (walkNodes(node.childNodes[i])) return true
            }
          }
          return false
        }
        
        walkNodes(editorRef.current)
        
        if (targetNode) {
          try {
            range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0))
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (e) {
            // Fallback to end of content if position is invalid
            range.selectNodeContents(editorRef.current)
            range.collapse(false)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }, 0)
    }, [onChange])

    // Handle paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      
      selection.deleteFromDocument()
      selection.getRangeAt(0).insertNode(document.createTextNode(text))
      selection.collapseToEnd()
      
      handleInput()
    }, [handleInput])

    // Insert dictation at cursor position
    const insertDictation = useCallback((text: string) => {
      if (!editorRef.current) return
      
      const selection = window.getSelection()
      if (!selection) return
      
      // Focus the editor if not focused
      if (document.activeElement !== editorRef.current) {
        editorRef.current.focus()
      }
      
      // Backend already processes commands like "new line" -> "\n" and "paragraph" -> "\n\n"
      // Backend sends text like "\n\n large joint effusion." - newlines followed by text
      
      // Check if text starts with newlines
      const leadingNewlines = text.match(/^(\n+)/)
      if (leadingNewlines) {
        const newlineCount = leadingNewlines[1].length
        const textAfterNewlines = text.substring(newlineCount)
        
        console.log('🎤 RichDiffEditor: Text has leading newlines:', { 
          newlineCount, 
          hasTextAfter: !!textAfterNewlines,
          textAfter: textAfterNewlines 
        })
        
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        // Insert BR elements for each newline
        for (let i = 0; i < newlineCount; i++) {
          const br = document.createElement('br')
          range.insertNode(br)
          range.setStartAfter(br)
        }
        
        // If there's text after the newlines, insert it too
        if (textAfterNewlines && textAfterNewlines.trim()) {
          const textNode = document.createTextNode(textAfterNewlines.trim())
          range.insertNode(textNode)
          range.setStartAfter(textNode)
        }
        
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else if (text.trim() === '') {
        // Empty or whitespace-only text, skip
        console.log('🎤 RichDiffEditor: Empty text received, skipping')
        return
      } else {
        // Regular text insertion
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      
      handleInput()
    }, [handleInput])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertDictation,
      getValue,
      getPlainText,
      setValue: (text: string) => {
        if (editorRef.current) {
          isInternalChange.current = true
          editorRef.current.textContent = text
          setDiffParts([]) // Clear diff when setting new value
          onChange(text)
          setTimeout(() => { isInternalChange.current = false }, 10)
        }
      },
      focus: () => editorRef.current?.focus(),
      getElement: () => editorRef.current,
      saveCursor: saveCursorPosition,
      setDiffParts: (parts: any[]) => {
        setDiffParts(parts)
        renderContent(true) // Force render when explicitly setting diff parts
      }
    }), [insertDictation, getValue, getPlainText, onChange, saveCursorPosition, renderContent])

    return (
      <div
        className={className}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          height: '100%',
          overflow: 'auto',
          ...style
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCopy={(e) => {
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
          }}
          style={{
            width: '100%',
            minHeight: '100%',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: theme === 'light' ? '#000000' : '#e0e0e0',
            backgroundColor: 'transparent',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
          data-placeholder={placeholder}
        />
      </div>
    )
  }
)

RichDiffEditor.displayName = 'RichDiffEditor'

export default RichDiffEditor