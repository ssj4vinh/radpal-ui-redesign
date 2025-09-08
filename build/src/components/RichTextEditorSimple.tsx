import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from 'react'

export interface RichTextEditorHandle {
  insertDictation: (text: string) => void
  getValue: () => string
  getPlainText: () => string
  setValue: (html: string) => void
  focus: () => void
  getElement: () => HTMLDivElement | null
  saveCursor: () => void
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  className?: string
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, placeholder, style, className }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const isInternalChange = useRef(false)
    const lastValue = useRef<string>('')
    const savedRange = useRef<Range | null>(null)

    // Convert number words to digits
    const convertNumberWords = useCallback((text: string): string => {
      const numberWords: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
        'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
      }
      
      let processed = text
      
      // Handle decimal numbers
      processed = processed.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+point\s+(zero|one|two|three|four|five|six|seven|eight|nine)/gi, 
        (match, whole, decimal) => {
          return (numberWords[whole.toLowerCase()] || whole) + '.' + (numberWords[decimal.toLowerCase()] || decimal)
        }
      )
      
      // Handle compound numbers
      processed = processed.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/gi,
        (match, tens, ones) => {
          const tensNum = parseInt(numberWords[tens.toLowerCase()] || '0')
          const onesNum = parseInt(numberWords[ones.toLowerCase()] || '0')
          return (tensNum + onesNum).toString()
        }
      )
      
      // Replace standalone number words
      for (const [word, digit] of Object.entries(numberWords)) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        processed = processed.replace(regex, digit)
      }
      
      return processed
    }, [])

    // Format text with basic HTML
    const formatText = useCallback((text: string) => {
      if (!text) return ''
      return text.replace(/\n/g, '<br>')
    }, [])

    // Save cursor position
    const saveCursorPosition = useCallback(() => {
      const sel = window.getSelection()
      console.log('🔍 saveCursorPosition called, selection:', sel?.rangeCount)
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0)
        // Only save if the selection is within our editor
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          savedRange.current = range.cloneRange()
          console.log('💾 Saved cursor position from saveCursorPosition, savedRange:', savedRange.current)
        } else {
          console.log('⚠️ Selection not in editor')
        }
      } else {
        console.log('⚠️ No selection to save')
      }
    }, [])

    // Restore cursor position
    const restoreCursorPosition = useCallback(() => {
      if (savedRange.current && editorRef.current) {
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(savedRange.current)
        }
      }
    }, [])

    // Handle input changes
    const handleInput = useCallback(() => {
      if (editorRef.current && !isInternalChange.current) {
        const html = editorRef.current.innerHTML
        lastValue.current = html
        onChange(html)
      }
    }, [onChange])

    // Handle paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
    }, [])

    // Initialize editor
    useEffect(() => {
      if (editorRef.current && !lastValue.current) {
        const initialValue = value || ''
        editorRef.current.innerHTML = initialValue
        lastValue.current = initialValue
      }
    }, [value])

    // Update editor when value changes externally
    useEffect(() => {
      if (editorRef.current && !isInternalChange.current) {
        const next = value || ''
        if (editorRef.current.innerHTML !== next) {
          editorRef.current.innerHTML = next
          lastValue.current = next
        }
      }
    }, [value])

    // Save cursor position on meaningful interactions
    useEffect(() => {
      const savePosition = () => {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0 && editorRef.current) {
          const range = sel.getRangeAt(0)
          if (editorRef.current.contains(range.commonAncestorContainer)) {
            savedRange.current = range.cloneRange()
            console.log('💾 Saved cursor position on user interaction, range:', savedRange.current)
          }
        }
      }
      
      if (!editorRef.current) return
      const editor = editorRef.current
      
      // Save on click, keyup, and focus
      editor.addEventListener('click', savePosition)
      editor.addEventListener('keyup', savePosition)
      editor.addEventListener('focus', savePosition)
      
      return () => {
        if (editor) {
          editor.removeEventListener('click', savePosition)
          editor.removeEventListener('keyup', savePosition)
          editor.removeEventListener('focus', savePosition)
        }
      }
    }, []) // Empty deps array - only runs once on mount

    // Insert dictation at cursor or end
    const insertDictation = useCallback((text: string) => {
      if (!editorRef.current) return

      console.log('🎤 RichTextEditor.insertDictation called with:', text)

      const trimmedText = text.trim().toLowerCase()
      
      // Handle special commands
      if (trimmedText === 'delete that' || trimmedText === 'scratch that') {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          if (!range.collapsed) {
            range.deleteContents()
          } else {
            // Delete last word
            const content = editorRef.current.textContent || ''
            const lastSpaceIndex = content.lastIndexOf(' ')
            if (lastSpaceIndex > 0) {
              editorRef.current.textContent = content.substring(0, lastSpaceIndex)
            }
          }
        }
        isInternalChange.current = true
        const newHtml = editorRef.current.innerHTML
        lastValue.current = newHtml
        onChange(newHtml)
        setTimeout(() => { isInternalChange.current = false }, 10)
        return
      }

      // Process text
      let processedText = convertNumberWords(text.trim())
      
      // Handle line breaks
      if (trimmedText === 'new line') {
        processedText = '\n'
      } else if (trimmedText === 'paragraph' || trimmedText === 'new paragraph') {
        processedText = '\n\n'
      }

      // Capitalize if needed
      const existingText = editorRef.current.textContent || ''
      if (existingText.length === 0 || /[.!?]\s*$/.test(existingText)) {
        if (processedText.length > 0 && /[a-z]/.test(processedText[0])) {
          processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1)
        }
      }

      // Insert at cursor or append
      isInternalChange.current = true
      editorRef.current.focus()

      // Try to restore saved cursor position first if we don't have a current selection
      const sel = window.getSelection()
      let hasValidSelection = false
      
      console.log('🔍 Checking selection state:', {
        hasSelection: sel && sel.rangeCount > 0,
        hasSavedRange: !!savedRange.current,
        savedRangeValid: savedRange.current ? editorRef.current.contains(savedRange.current.commonAncestorContainer) : false
      })
      
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0)
        if (editorRef.current.contains(r.commonAncestorContainer)) {
          hasValidSelection = true
          console.log('📍 Using current selection')
        }
      }
      
      if (!hasValidSelection && savedRange.current) {
        try {
          // Check if saved range is still valid
          if (editorRef.current.contains(savedRange.current.commonAncestorContainer)) {
            sel?.removeAllRanges()
            sel?.addRange(savedRange.current)
            console.log('✅ Restored saved cursor position')
            hasValidSelection = true
          } else {
            console.log('⚠️ Saved cursor no longer valid - container not in editor')
            savedRange.current = null
          }
        } catch (e) {
          console.log('⚠️ Could not restore saved cursor:', e)
          savedRange.current = null
        }
      } else if (!hasValidSelection) {
        console.log('⚠️ No saved range to restore')
      }

      let inserted = false

      if (hasValidSelection && sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          console.log('📍 Inserting at cursor/selection position')
          // Delete selected content
          range.deleteContents()
          
          // Insert new text
          if (processedText === '\n' || processedText === '\n\n') {
            const brs = processedText === '\n\n' ? [document.createElement('br'), document.createElement('br')] : [document.createElement('br')]
            brs.forEach(br => range.insertNode(br))
            range.setStartAfter(brs[brs.length - 1])
          } else {
            // Add spacing if needed
            const before = range.startContainer.textContent || ''
            const beforeChar = before[range.startOffset - 1] || ''
            if (beforeChar && /[A-Za-z0-9]/.test(beforeChar) && /[A-Za-z0-9]/.test(processedText[0])) {
              processedText = ' ' + processedText
            }
            
            const textNode = document.createTextNode(processedText)
            range.insertNode(textNode)
            range.setStartAfter(textNode)
          }
          
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
          
          // Save new cursor position
          savedRange.current = range.cloneRange()
          inserted = true
        }
      }

      // Fallback: append to end
      if (!inserted) {
        console.log('⚠️ Fallback: appending to end')
        if (processedText === '\n' || processedText === '\n\n') {
          const brs = processedText === '\n\n' ? [document.createElement('br'), document.createElement('br')] : [document.createElement('br')]
          brs.forEach(br => editorRef.current!.appendChild(br))
        } else {
          // Add spacing if needed
          if (existingText.length > 0 && /[A-Za-z0-9]$/.test(existingText) && /^[A-Za-z0-9]/.test(processedText)) {
            processedText = ' ' + processedText
          }
          editorRef.current.appendChild(document.createTextNode(processedText))
        }
      }

      const newHtml = editorRef.current.innerHTML
      lastValue.current = newHtml
      onChange(newHtml)
      
      setTimeout(() => { 
        isInternalChange.current = false 
      }, 10)
    }, [onChange, convertNumberWords])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertDictation,
      getValue: () => editorRef.current?.innerHTML || lastValue.current || '',
      getPlainText: () => editorRef.current?.innerText || '',
      setValue: (html: string) => {
        if (editorRef.current) {
          isInternalChange.current = true
          const formatted = formatText(html)
          editorRef.current.innerHTML = formatted
          lastValue.current = formatted
          onChange(formatted)
          setTimeout(() => { isInternalChange.current = false }, 100)
        }
      },
      focus: () => editorRef.current?.focus(),
      getElement: () => editorRef.current,
      saveCursor: () => {
        console.log('🎯 saveCursor called explicitly from App.tsx')
        saveCursorPosition()
      }
    }), [insertDictation, formatText, onChange, saveCursorPosition])

    return (
      <div
        className={className}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          ...style
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '100%',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#e0e0e0',
            backgroundColor: 'transparent',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowY: 'auto'
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
    )
  }
)

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor