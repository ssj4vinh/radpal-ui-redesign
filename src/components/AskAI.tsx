import React, { useState, useEffect, useRef } from 'react'
import { Send, X, RefreshCw, Copy, MessageCircle } from 'lucide-react'
// import BlurCard from './BlurCard' - replaced with solid container
import { sendChat } from '../lib/chat/sendChat'
import { createSession, getSession, appendMessage } from '../supabase/chatSessionsIPC'
import { askAISystemPrompt } from '../../agent/prompts/askAISystemPrompt'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp?: Date
}

interface AskAIProps {
  userId: string
  studyType: string
  reportText: string
  reportId?: string
  sessionId?: string
  onClose: () => void
}

export default function AskAI({ 
  userId, 
  studyType, 
  reportText, 
  reportId,
  sessionId: providedSessionId,
  onClose 
}: AskAIProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(providedSessionId || '')
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Initialize session and load history
  useEffect(() => {
    const initializeSession = async () => {
      try {
        if (!sessionId) {
          // Create new session
          const systemMessage: Message = {
            role: 'system',
            content: `${askAISystemPrompt}\n\nThis is the current radiology report for reference:\n\n${reportText}`,
            timestamp: new Date()
          }
          
          // Generate UUID format report ID if not provided
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0
              const v = c == 'x' ? r : (r & 0x3 | 0x8)
              return v.toString(16)
            })
          }
          
          const finalReportId = reportId || generateUUID()
          
          // Create session in Supabase
          const { data: newSession, error } = await createSession(finalReportId, studyType, reportText)
          if (error) throw error
          
          if (newSession) {
            setSessionId(newSession.id)
            // Initialize messages with system prompt and report
            const initialMessages = [systemMessage]
            setMessages(initialMessages)
            
            // Store the system message
            await appendMessage(newSession.id, systemMessage)
          }
        } else {
          // Load existing session
          const { data: session, error } = await getSession(sessionId)
          if (error) throw error
          
          if (session && session.messages) {
            setMessages(session.messages)
          }
        }
      } catch (err) {
        console.error('Failed to initialize session:', {
          error: err instanceof Error ? err.message : err,
          fullError: JSON.stringify(err, null, 2)
        })
        setError(`Failed to initialize chat session: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    initializeSession()
  }, [userId, studyType, reportText])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)
    setError(null)

    try {
      // Get the selected AI model from window API
      const selectedModel = await window.electronAPI?.getSelectedModel?.() || 'claude-3-sonnet'
      
      // Prepare messages for API
      const apiMessages = messages.concat(userMessage).map(({ role, content }) => ({ role, content }))
      
      // Send chat using the new API
      const response = await sendChat(apiMessages, selectedModel)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.text) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.text,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Store messages in Supabase
        if (sessionId) {
          await appendMessage(sessionId, userMessage)
          await appendMessage(sessionId, assistantMessage)
        }
      } else {
        throw new Error('No response received')
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to get response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaClick = () => {
    textareaRef.current?.focus()
  }

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Only allow dragging from header or empty areas, not buttons, inputs, or scrollable content
    if (target.closest('.drag-handle') && !target.closest('button') && !target.closest('input') && !target.closest('textarea')) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    } else if (isResizing) {
      const newWidth = Math.max(400, resizeStart.width + (e.clientX - resizeStart.x))
      const newHeight = Math.max(300, resizeStart.height + (e.clientY - resizeStart.y))
      setSize({
        width: newWidth,
        height: newHeight
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
  }

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart])

  const handleRegenerateLastResponse = async () => {
    if (messages.length < 2 || isLoading) return

    // Find the last user message
    let lastUserIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i
        break
      }
    }

    if (lastUserIndex === -1) return

    // Remove messages after the last user message
    const newMessages = messages.slice(0, lastUserIndex + 1)
    setMessages(newMessages)

    // Resend the last user message
    const lastUserMessage = messages[lastUserIndex]
    setIsLoading(true)
    setError(null)

    try {
      const selectedModel = await window.electronAPI?.getSelectedModel?.() || 'claude-3-sonnet'
      const apiMessages = newMessages.map(({ role, content }) => ({ role, content }))
      
      const response = await sendChat(apiMessages, selectedModel)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.text) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.text,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Store regenerated message in Supabase
        if (sessionId) {
          await appendMessage(sessionId, assistantMessage)
        }
      }
    } catch (err) {
      console.error('Failed to regenerate response:', err)
      setError('Failed to regenerate response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyConversation = () => {
    const conversationText = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')
    
    navigator.clipboard.writeText(conversationText)
  }

  return (
    <div 
      ref={modalRef}
      style={{
        position: 'fixed',
        top: position.y === 0 ? '50%' : `${position.y + window.innerHeight / 2}px`,
        left: position.x === 0 ? '50%' : `${position.x + window.innerWidth / 2}px`,
        transform: 'translate(-50%, -50%)',
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: '400px',
        minHeight: '300px',
        maxWidth: '95vw',
        maxHeight: '95vh',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : (isResizing ? 'nw-resize' : 'default')
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        padding: '20px',
        gap: '16px',
        backgroundColor: 'rgba(30, 30, 30, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '16px',
        color: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        {/* Header */}
        <div className="drag-handle" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'grab',
          userSelect: 'none'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Ask AI Assistant</h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: '12px', 
              opacity: 0.7 
            }}>
              Assistant will not modify your report
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyConversation}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                opacity: messages.length > 1 ? 1 : 0.5,
                pointerEvents: messages.length > 1 ? 'auto' : 'none'
              }}
              title="Copy conversation"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: 'rgba(20, 20, 20, 0.8)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '0', // Important for flex scrolling
          scrollBehavior: 'smooth'
        }}>
          {messages.filter(m => m.role !== 'system').map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{
                background: message.role === 'user' 
                  ? 'rgba(59, 130, 246, 0.8)' 
                  : 'rgba(70, 70, 70, 0.9)',
                borderRadius: '12px',
                padding: '12px 16px',
                wordBreak: 'break-word',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
              </div>
              {message.timestamp && (
                <div style={{
                  fontSize: '11px',
                  opacity: 0.5,
                  paddingX: '8px',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: '80%',
              background: 'rgba(70, 70, 70, 0.9)',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div className="loading-dots">Thinking...</div>
            </div>
          )}
          
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.8)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#ffffff',
              border: '1px solid rgba(239, 68, 68, 0.5)'
            }}>
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          display: 'flex',
          gap: '8px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the report or radiology concepts..."
            disabled={isLoading}
            autoFocus
            style={{
              flex: 1,
              minHeight: '60px',
              maxHeight: '120px',
              background: 'rgba(40, 40, 40, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              color: '#ffffff',
              pointerEvents: 'auto',
              zIndex: 'auto',
              userSelect: 'text',
              WebkitUserSelect: 'text'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                opacity: (!inputText.trim() || isLoading) ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
              title="Send message"
            >
              <Send size={18} />
            </button>
            <button
              onClick={handleRegenerateLastResponse}
              disabled={messages.filter(m => m.role === 'assistant').length === 0 || isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                opacity: (messages.filter(m => m.role === 'assistant').length === 0 || isLoading) ? 0.5 : 1
              }}
              title="Regenerate last response"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        
        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '16px',
            height: '16px',
            cursor: 'se-resize',
            background: 'linear-gradient(-45deg, transparent 30%, rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 35%, transparent 35%, transparent 65%, rgba(255,255,255,0.5) 65%, rgba(255,255,255,0.5) 70%, transparent 70%)',
            borderRadius: '2px',
            zIndex: 10
          }}
          title="Drag to resize"
        />
      </div>
    </div>
  )
}