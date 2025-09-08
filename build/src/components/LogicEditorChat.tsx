import React, { useState, useEffect } from 'react'
import { updateAgentLogicWithOffline, resetAgentLogicToDefaultWithOffline, getCurrentAgentLogicWithOffline } from '../supabase/updateAgentLogicWithOffline'
import { EDIT_LOGIC_SYSTEM_PROMPT } from '../../agent/prompts/editLogicSystemPrompt'

interface LogicEditorChatProps {
  userId: string
  studyType: string
  templates?: Record<string, any>
  onClose: () => void
  isOfflineMode?: boolean
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}


export default function LogicEditorChat({ userId, studyType, templates = {}, onClose, isOfflineMode = false }: LogicEditorChatProps) {
  // Early return if essential props are missing
  if (!userId || !onClose) {
    console.error('LogicEditorChat: Missing essential props (userId or onClose)')
    return null
  }

  const [selectedStudyType, setSelectedStudyType] = useState<string>(studyType)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentLogic, setCurrentLogic] = useState<any>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pendingChanges, setPendingChanges] = useState<any>(null)
  const [isSavingChanges, setIsSavingChanges] = useState(false)

  // Helper function to handle logic value changes
  const handleLogicChange = (path: string[], newValue: any) => {
    console.log('Logic change:', path.join('.'), '=', newValue) // Debug log
    
    // Convert spaces to underscores for string values and arrays before saving
    let processedValue = newValue
    if (typeof newValue === 'string') {
      processedValue = newValue.replace(/\s+/g, '_').toLowerCase()
    } else if (Array.isArray(newValue)) {
      processedValue = newValue.map(item => 
        typeof item === 'string' ? item.replace(/\s+/g, '_').toLowerCase() : item
      )
    }
    
    const updatedLogic = JSON.parse(JSON.stringify(currentLogic)) // Deep clone
    const changes = JSON.parse(JSON.stringify(pendingChanges || {})) // Deep clone pending changes
    
    // Navigate to the nested property and update it
    let current = updatedLogic
    let changesCurrent = changes
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {}
      }
      current = current[path[i]]
      
      if (!changesCurrent[path[i]]) {
        changesCurrent[path[i]] = {}
      }
      changesCurrent = changesCurrent[path[i]]
    }
    
    current[path[path.length - 1]] = processedValue
    changesCurrent[path[path.length - 1]] = processedValue
    
    setCurrentLogic(updatedLogic)
    setPendingChanges(changes)
    console.log('Pending changes:', changes) // Debug log
  }

  // Save pending changes
  const savePendingChanges = async () => {
    if (!pendingChanges || Object.keys(pendingChanges).length === 0) return
    
    setIsSavingChanges(true)
    try {
      const updateResult = await updateAgentLogicWithOffline(userId, selectedStudyType, pendingChanges, isOfflineMode)
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update logic')
      }
      
      setCurrentLogic(updateResult.finalLogic)
      setPendingChanges(null)
      showToast('success', 'Settings saved successfully!')
      
      // Add a system message
      setMessages(prev => [...prev, {
        type: 'system',
        content: '✅ Settings updated successfully!',
        timestamp: Date.now()
      }])
    } catch (error) {
      showToast('error', `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSavingChanges(false)
    }
  }

  // Format logic object for interactive display
  const formatLogicForDisplay = (logic: any): React.ReactNode => {
    if (!logic) return null

    const formatValue = (value: any): string => {
      if (typeof value === 'string') {
        return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
      if (Array.isArray(value)) {
        if (value.length === 0) return 'None'
        return value.map(v => typeof v === 'string' ? v.replace(/_/g, ' ') : v).join(', ')
      }
      return String(value)
    }

    const formatSectionName = (name: string): string => {
      return name
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/^(Report|Impression|Clinical|Style|Formatting|Measurements|Severity|Anatomy)$/, '📋 $1')
    }

    const renderSection = (obj: any, path: string[] = [], depth: number = 0): React.ReactNode => {
      return Object.entries(obj).map(([key, value]) => {
        // Skip version and custom_instructions in main display
        if (depth === 0 && (key === 'version' || key === 'custom_instructions')) {
          return null
        }

        const currentPath = [...path, key]
        const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
        const formattedKey = depth === 0 ? formatSectionName(key) : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        
        return (
          <div key={key} style={{ marginLeft: depth * 20, marginBottom: depth === 0 ? 12 : 6 }}>
            {isObject ? (
              <>
                <div style={{ 
                  fontWeight: depth === 0 ? 600 : 500, 
                  color: depth === 0 ? '#3ABC96' : '#fff',
                  marginBottom: 6,
                  fontSize: depth === 0 ? 14 : 13
                }}>
                  {formattedKey}
                </div>
                {renderSection(value, currentPath, depth + 1)}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#999', fontSize: 12 }}>•</span>
                <span style={{ color: '#aaa', flex: 1, fontSize: 12 }}>
                  {formattedKey}:
                </span>
                {typeof value === 'boolean' ? (
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    gap: 6
                  }}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => handleLogicChange(currentPath, e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: 'pointer',
                        accentColor: '#3ABC96'
                      }}
                    />
                    <span style={{ 
                      color: value ? '#3ABC96' : '#E36756',
                      fontWeight: 500,
                      fontSize: 12
                    }}>
                      {value ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </label>
                ) : Array.isArray(value) ? (
                  <input
                    type="text"
                    value={value.map(v => typeof v === 'string' ? v.replace(/_/g, ' ') : v).join(', ')}
                    onChange={(e) => {
                      const newArray = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      handleLogicChange(currentPath, newArray)
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 12,
                      minWidth: 200,
                      outline: 'none'
                    }}
                    placeholder="Enter items separated by commas (e.g., item one, item two, item three)"
                  />
                ) : typeof value === 'string' ? (
                  <input
                    type="text"
                    value={value.replace(/_/g, ' ')}
                    onChange={(e) => handleLogicChange(currentPath, e.target.value)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 12,
                      minWidth: 150,
                      outline: 'none'
                    }}
                  />
                ) : (
                  <span style={{ color: '#fff', fontSize: 12 }}>
                    {formatValue(value)}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      }).filter(Boolean)
    }

    return (
      <div>
        {logic.version && (
          <div style={{ color: '#666', fontSize: 11, marginBottom: 12 }}>
            Version: {logic.version}
          </div>
        )}
        {renderSection(logic)}
        {logic.custom_instructions && logic.custom_instructions.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontWeight: 600, color: '#3ABC96', marginBottom: 8, fontSize: 14 }}>
              📝 Custom Instructions
            </div>
            {logic.custom_instructions.map((instruction: string, index: number) => (
              <div key={index} style={{ marginLeft: 20, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#666', fontSize: 11 }}>{index + 1}.</span>
                <span style={{ color: '#ccc', fontSize: 12 }}>{instruction}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Load current logic when study type changes (with debouncing)
  useEffect(() => {
    if (selectedStudyType && selectedStudyType.trim()) {
      // Clear previous messages and show loading state
      setMessages([{
        type: 'system',
        content: `Loading logic for ${selectedStudyType}...`,
        timestamp: Date.now()
      }])
      setCurrentLogic(null)
      
      // Debounce the API call to prevent too many calls while typing
      const timeoutId = setTimeout(() => {
        loadCurrentLogic()
      }, 800)
      
      return () => clearTimeout(timeoutId)
    } else {
      setCurrentLogic(null)
      setMessages([{
        type: 'system',
        content: 'Please select a study type to edit its logic configuration.',
        timestamp: Date.now()
      }])
    }
  }, [selectedStudyType, userId])

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const loadCurrentLogic = async () => {
    if (!selectedStudyType || !selectedStudyType.trim()) return
    
    // Check if the study type exists in templates
    const availableStudyTypes = Object.keys(templates || {})
    if (availableStudyTypes.length > 0 && !availableStudyTypes.includes(selectedStudyType)) {
      setMessages([{
        type: 'system',
        content: `Study type "${selectedStudyType}" not found. Please select from available templates or create a new template first.`,
        timestamp: Date.now()
      }])
      setCurrentLogic(null)
      setPendingChanges(null) // Clear pending changes
      return
    }
    
    const result = await getCurrentAgentLogicWithOffline(userId, selectedStudyType, isOfflineMode)
    if (result.error) {
      showToast('error', `Failed to load current logic: ${result.error}`)
      setMessages([{
        type: 'system',
        content: `Error loading logic for ${selectedStudyType}: ${result.error}`,
        timestamp: Date.now()
      }])
    } else {
      setCurrentLogic(result.logic)
      setPendingChanges(null) // Clear pending changes when loading new logic
      setMessages([{
        type: 'system',
        content: `Current logic loaded for ${selectedStudyType}. You can now give instructions to modify your report generation logic or directly toggle the settings below.`,
        timestamp: Date.now()
      }])
    }
  }

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !selectedStudyType) return

    const userMessage: ChatMessage = {
      type: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Call Claude API to process the instruction (always uses Claude Sonnet regardless of user's API provider)
      const response = await callClaudeAPI(inputValue.trim())
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to process instruction')
      }

      // Parse the JSON response
      let delta
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = response.content;
        if (response.content.includes('```')) {
          cleanedResponse = response.content
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
        }
        delta = JSON.parse(cleanedResponse)
        console.log('🧮 LogicEditorChat: Parsed delta from Claude:', JSON.stringify(delta, null, 2))
      } catch (parseError) {
        console.error('❌ LogicEditorChat: Failed to parse JSON response:', response.content)
        throw new Error('Invalid JSON response from AI')
      }

      // Update the agent logic in Supabase
      console.log('💾 LogicEditorChat: Updating agent logic in Supabase...')
      console.log('📊 Delta to apply:', JSON.stringify(delta, null, 2))
      const updateResult = await updateAgentLogicWithOffline(userId, selectedStudyType, delta, isOfflineMode)
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update logic')
      }

      // Update local state
      setCurrentLogic(updateResult.finalLogic)
      console.log('✅ LogicEditorChat: Logic updated successfully!')
      console.log('🎯 Final merged logic:', JSON.stringify(updateResult.finalLogic, null, 2))

      // Add success message with token usage
      const tokenInfo = response.tokens ? 
        `\n\n📊 Token usage: ${response.tokens.input} input + ${response.tokens.output} output = ${response.tokens.total} total` : 
        '';
      
      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: `✅ Logic updated successfully! Applied changes: ${JSON.stringify(delta, null, 2)}${tokenInfo}`,
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
      showToast('success', 'Logic updated successfully!')

    } catch (error) {
      const errorMessage: ChatMessage = {
        type: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
      showToast('error', `Failed to update logic: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const callClaudeAPI = async (instruction: string): Promise<{ success: boolean; content: string; tokens?: { input: number; output: number; total: number }; error?: string }> => {
    try {
      // Always use Claude Sonnet for logic editing, regardless of user's selected provider
      const prompt = `${EDIT_LOGIC_SYSTEM_PROMPT}\n\nCurrent logic:\n${JSON.stringify(currentLogic, null, 2)}\n\nUser instruction: ${instruction}`
      
      
      // Use the new IPC method that forces Claude Sonnet usage
      const response = await window.electronAPI?.generateReportWithProvider?.(prompt, 'claude-sonnet')
      
      if (!response) {
        console.error('❌ LogicEditorChat: No response from Claude API')
        return { success: false, error: 'No response from Claude API' }
      }

      // Debug: Log the response from Claude
      const responseText = typeof response === 'string' ? response : response?.text || ''
      const tokens = response?.tokens || { input: 0, output: 0, total: 0 }
      console.log('📥 LogicEditorChat: Response from Claude:')
      console.log('─'.repeat(80))
      console.log(responseText)
      console.log('─'.repeat(80))
      console.log('🎯 Token usage:', tokens)

      // Handle response
      if (typeof response === 'string') {
        return { success: true, content: response, tokens: { input: 0, output: 0, total: 0 } }
      } else if (response?.text) {
        return { success: true, content: response.text, tokens }
      } else {
        console.error('❌ LogicEditorChat: Invalid response format:', response)
        return { success: false, error: 'Invalid response format' }
      }
    } catch (error) {
      console.error('❌ LogicEditorChat: API call failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'API call failed' 
      }
    }
  }

  const handleReset = async () => {
    if (!selectedStudyType) return
    
    setIsLoading(true)
    try {
      const result = await resetAgentLogicToDefaultWithOffline(userId, selectedStudyType, isOfflineMode)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset logic')
      }

      setCurrentLogic(result.finalLogic)
      setMessages(prev => [...prev, {
        type: 'system',
        content: '🔄 Logic reset to default settings.',
        timestamp: Date.now()
      }])
      showToast('success', 'Logic reset to default successfully!')
      
    } catch (error) {
      showToast('error', `Failed to reset logic: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setShowResetConfirm(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
      
      <div style={{
        width: '90%',
        maxWidth: 800,
        height: '90%',
        backgroundColor: 'rgba(42, 45, 49, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ color: '#fff', margin: '0 0 12px 0', fontSize: 20, fontWeight: 600 }}>
              Edit Logic
            </h2>
            
            {/* Study Type Selector */}
            <div style={{ marginBottom: '8px' }}>
              <input
                list="logic-study-types"
                value={selectedStudyType}
                onChange={(e) => setSelectedStudyType(e.target.value)}
                placeholder="Select or search study type..."
                disabled={false}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: selectedStudyType ? '#fff' : '#999',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <datalist id="logic-study-types">
                {templates && Object.keys(templates).sort().map(studyType => (
                  <option key={studyType} value={studyType} />
                ))}
              </datalist>
            </div>
            
            <p style={{ color: '#999', margin: 0, fontSize: 14 }}>
              {selectedStudyType 
                ? `Editing logic for ${selectedStudyType}`
                : 'Select a study type to edit its logic'
              }
            </p>
            <p style={{ color: '#3ABC96', margin: '4px 0 0 0', fontSize: 12, fontWeight: 500 }}>
              🤖 Powered by Claude 4 Sonnet{isOfflineMode && ' • 🔌 Offline Mode'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: 24,
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Chat Messages */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%'
              }}
            >
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: message.type === 'user' 
                  ? 'rgba(58, 188, 150, 0.2)' 
                  : message.type === 'system' 
                    ? 'rgba(100, 100, 100, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 14,
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap'
              }}>
                {message.content}
              </div>
              <div style={{
                fontSize: 11,
                color: '#666',
                textAlign: message.type === 'user' ? 'right' : 'left',
                marginTop: '4px'
              }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 14
              }}>
                Processing your instruction...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end'
        }}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedStudyType 
              ? "Type your instruction (e.g., 'Make my impression more concise')" 
              : "Select a study type first"
            }
            disabled={isLoading || !selectedStudyType}
            style={{
              flex: 1,
              minHeight: 60,
              maxHeight: 120,
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              opacity: selectedStudyType ? 1 : 0.5
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || !selectedStudyType}
            style={{
              padding: '12px 20px',
              backgroundColor: (!inputValue.trim() || isLoading || !selectedStudyType) 
                ? 'rgba(100, 100, 100, 0.3)' 
                : 'rgba(58, 188, 150, 0.2)',
              border: '1px solid rgba(58, 188, 150, 0.3)',
              borderRadius: 8,
              color: (!inputValue.trim() || isLoading || !selectedStudyType) ? '#666' : '#3ABC96',
              fontSize: 14,
              fontWeight: 500,
              cursor: (!inputValue.trim() || isLoading || !selectedStudyType) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Send
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={isLoading || !selectedStudyType}
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(227, 103, 86, 0.2)',
              border: '1px solid rgba(227, 103, 86, 0.3)',
              borderRadius: 8,
              color: (isLoading || !selectedStudyType) ? '#666' : '#E36756',
              fontSize: 14,
              fontWeight: 500,
              cursor: (isLoading || !selectedStudyType) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Reset
          </button>
        </div>

        {/* Current Logic Display */}
        {currentLogic && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            maxHeight: '300px',
            overflowY: 'auto',
            position: 'relative'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 12
            }}>
              <h4 style={{ color: '#fff', margin: 0, fontSize: 14 }}>
                Current Logic Configuration:
              </h4>
              <button
                onClick={savePendingChanges}
                disabled={isSavingChanges || !pendingChanges || Object.keys(pendingChanges || {}).length === 0}
                style={{
                  padding: '8px 20px',
                  backgroundColor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0) 
                    ? 'rgba(100, 100, 100, 0.2)' 
                    : isSavingChanges 
                      ? 'rgba(100, 100, 100, 0.3)' 
                      : 'rgba(58, 188, 150, 0.3)',
                  border: '1px solid rgba(58, 188, 150, 0.4)',
                  borderRadius: 8,
                  color: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0) 
                    ? '#666' 
                    : isSavingChanges 
                      ? '#999' 
                      : '#3ABC96',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0 || isSavingChanges) 
                    ? 'not-allowed' 
                    : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: (!pendingChanges || Object.keys(pendingChanges || {}).length === 0) ? 0.5 : 1
                }}
              >
                {isSavingChanges ? (
                  <>
                    <span style={{ 
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      border: '2px solid #999',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Saving...
                  </>
                ) : (pendingChanges && Object.keys(pendingChanges).length > 0) ? (
                  <>
                    💾 Save Changes
                  </>
                ) : (
                  <>
                    ✓ No Changes
                  </>
                )}
              </button>
            </div>
            <div style={{
              color: '#ccc',
              fontSize: 13,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.6
            }}>
              {formatLogicForDisplay(currentLogic)}
            </div>
            {pendingChanges && Object.keys(pendingChanges).length > 0 && (
              <div style={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 8,
                height: 8,
                backgroundColor: '#FFA500',
                borderRadius: '50%',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
            )}
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgba(42, 45, 49, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            padding: '24px',
            maxWidth: 400
          }}>
            <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 18 }}>
              Reset to Default Logic?
            </h3>
            <p style={{ color: '#999', margin: '0 0 24px 0', fontSize: 14 }}>
              This will reset all custom logic settings to their default values. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(227, 103, 86, 0.2)',
                  border: '1px solid rgba(227, 103, 86, 0.3)',
                  borderRadius: 6,
                  color: '#E36756',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '12px 16px',
          backgroundColor: toastMessage.type === 'success' 
            ? 'rgba(58, 188, 150, 0.9)' 
            : 'rgba(227, 103, 86, 0.9)',
          border: `1px solid ${toastMessage.type === 'success' ? '#3ABC96' : '#E36756'}`,
          borderRadius: 8,
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 1001
        }}>
          {toastMessage.text}
        </div>
      )}
    </div>
  )
}