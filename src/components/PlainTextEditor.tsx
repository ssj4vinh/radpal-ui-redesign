import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from 'react'

export interface PlainTextEditorHandle {
  insertDictation: (text: string) => void
  getValue: () => string
  getPlainText: () => string
  setValue: (text: string) => void
  focus: () => void
  getElement: () => HTMLTextAreaElement | null
}

interface PlainTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  className?: string
  theme?: string
}

const PlainTextEditor = forwardRef<PlainTextEditorHandle, PlainTextEditorProps>(
  ({ value, onChange, placeholder, style, className, theme }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const isInternalChange = useRef(false)
    // Initialize cursor position - will be set properly on first render
    const lastCursorPosition = useRef<{start: number, end: number}>({ 
      start: -1,  // Use -1 to indicate not initialized
      end: -1 
    })
    const hasInitialized = useRef(false)

    // Initialize cursor position on first render with actual value
    useEffect(() => {
      // Only set initial position once when component mounts
      if (!hasInitialized.current) {
        hasInitialized.current = true
        lastCursorPosition.current = {
          start: value.length,
          end: value.length
        }
        console.log('🎯 Initial cursor position set to:', value.length)
      }
    }, []) // Run only once on mount

    // Update cursor position when value changes externally (e.g., loading new study)
    useEffect(() => {
      // Only reset cursor position if text was cleared or significantly changed
      // Don't reset if we're in the middle of dictation
      if (!isInternalChange.current && hasInitialized.current) {
        if (value.length === 0 && lastCursorPosition.current.start > 0) {
          // Text was cleared, reset to beginning
          lastCursorPosition.current = {
            start: 0,
            end: 0
          }
          console.log('📍 Text cleared, reset cursor to 0')
        }
        // Removed the "significant change" check as it was causing issues
      }
    }, [value.length])

    // Save cursor position whenever selection changes or on blur
    const saveCursorPosition = useCallback(() => {
      const textarea = textareaRef.current
      if (textarea) {
        lastCursorPosition.current = {
          start: textarea.selectionStart,
          end: textarea.selectionEnd
        }
        console.log('💾 Saved cursor position:', lastCursorPosition.current)
      }
    }, [])

    // Insert dictation at cursor position
    const insertDictation = useCallback((rawText: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      console.log('🎤 PlainTextEditor.insertDictation called with:', rawText)
      console.log('📍 Current textarea selectionStart:', textarea.selectionStart)
      console.log('📍 Current textarea selectionEnd:', textarea.selectionEnd)
      console.log('📍 Saved cursor position:', lastCursorPosition.current)
      console.log('📍 Text length:', textarea.value.length)

      const currentValue = textarea.value
      
      // Use the last saved cursor position
      const insertPosition = lastCursorPosition.current.start
      const selectionEnd = lastCursorPosition.current.end
      
      console.log('🎤 Will insert at position:', insertPosition, 'replacing up to:', selectionEnd)

      // Check if we need to add spacing before the new text
      let textToInsert = rawText
      if (insertPosition > 0) {
        const charBefore = currentValue[insertPosition - 1]
        const firstCharOfNew = rawText[0]
        
        // Add space if:
        // - Previous char is not whitespace or punctuation
        // - New text doesn't start with whitespace or punctuation
        // - We're not immediately after a newline
        if (charBefore && 
            !/[\s\n.,;:!?]/.test(charBefore) && 
            firstCharOfNew && 
            !/[\s\n.,;:!?]/.test(firstCharOfNew)) {
          textToInsert = ' ' + rawText
          console.log('🔤 Adding space before dictated text')
        }
      }

      // Insert the text at the saved position
      const newValue = 
        currentValue.slice(0, insertPosition) + 
        textToInsert + 
        currentValue.slice(selectionEnd)
      
      const newCursorPos = insertPosition + textToInsert.length

      // Update the textarea
      isInternalChange.current = true
      textarea.value = newValue
      
      // Focus the textarea and set cursor position
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      
      // Update saved cursor position
      lastCursorPosition.current = {
        start: newCursorPos,
        end: newCursorPos
      }
      
      onChange(newValue)
      
      setTimeout(() => {
        isInternalChange.current = false
      }, 10)

      console.log('🎤 Dictation inserted at position', insertPosition, 'new cursor at', newCursorPos)
    }, [onChange])

    // Handle manual changes
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isInternalChange.current) {
        onChange(e.target.value)
        // Save cursor position after change
        saveCursorPosition()
      }
    }, [onChange, saveCursorPosition])

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Tab key
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = e.currentTarget
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const value = textarea.value
        
        const newValue = value.substring(0, start) + '\t' + value.substring(end)
        textarea.value = newValue
        textarea.setSelectionRange(start + 1, start + 1)
        onChange(newValue)
      }
    }, [onChange])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertDictation,
      getValue: () => textareaRef.current?.value || '',
      getPlainText: () => textareaRef.current?.value || '',
      setValue: (text: string) => {
        if (textareaRef.current) {
          isInternalChange.current = true
          textareaRef.current.value = text
          onChange(text)
          setTimeout(() => {
            isInternalChange.current = false
          }, 10)
        }
      },
      focus: () => textareaRef.current?.focus(),
      getElement: () => textareaRef.current
    }), [insertDictation, onChange])

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={saveCursorPosition}      // Save on key up (after cursor moves)
        onClick={saveCursorPosition}       // Save on click
        onBlur={saveCursorPosition}        // Save on blur
        onFocus={saveCursorPosition}       // Save on focus
        placeholder={placeholder}
        style={{
          width: '100%',
          height: '100%',
          padding: '12px',
          fontSize: '15px',
          lineHeight: '1.6',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          resize: 'none',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          outline: 'none',
          backgroundColor: theme === 'dark' ? '#1e1f23' : '#ffffff',
          color: theme === 'dark' ? '#ffffff' : '#000000',
          ...style
        }}
        className={className}
        spellCheck={false}
      />
    )
  }
)

PlainTextEditor.displayName = 'PlainTextEditor'

export default PlainTextEditor