import { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { diffWordsWithSpace } from 'diff'
import TemplateManager from './components/TemplateManager'
import LogicManager from './components/LogicManager'
import { useSupabaseTemplates } from './hooks/useSupabaseTemplates'
import { useSupabaseTemplatesWithOffline } from './hooks/useSupabaseTemplatesWithOffline'
import { supabase } from './lib/supabase'
import { useUser } from './hooks/useUser'
import BlurCard from './components/BlurCard'
import AskAI from './components/AskAI'
import DragTextEditor from './components/DragTextEditor'
import { MessageCircle } from 'lucide-react'

function App() {
  const [mode, setMode] = useState('unknown')
  const [resultText, setResultText] = useState('')
  const [templateText, setTemplateText] = useState('')
  const [showDiffView, setShowDiffView] = useState(true) // Default to true
  const { user, loading: authLoading } = useUser()
  const [shouldUseSupabase, setShouldUseSupabase] = useState(false)
  const [editedOutput, setEditedOutput] = useState('')
  // Removed diffGranularity state - now always uses 'words' mode
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null)
  
  // Refinement feature state
  const [refinementInput, setRefinementInput] = useState('')
  const [originalResultText, setOriginalResultText] = useState('') // Store the original GPT result
  const [previousResultText, setPreviousResultText] = useState('') // Store previous result for diff comparison
  const [isRefining, setIsRefining] = useState(false)
  
  const [refinementHistory, setRefinementHistory] = useState<string[]>([]) // Track all refinement steps
  const [redoHistory, setRedoHistory] = useState<string[]>([]) // Track undone refinements for redo
  const [diffBoxHeight, setDiffBoxHeight] = useState(350) // Persistent diff box height
  const [refinementBoxHeight, setRefinementBoxHeight] = useState(160) // Persistent refinement box height
  const [mainTextareaHeight, setMainTextareaHeight] = useState(400) // Persistent main textarea height
  
  // Feedback feature state
  const [feedbackInput, setFeedbackInput] = useState('')
  const [studyType, setStudyType] = useState('')
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false)
  const [feedbackBoxHeight, setFeedbackBoxHeight] = useState(160) // Persistent feedback box height
  
  // Generation time and token usage state
  const [generationTime, setGenerationTime] = useState<string | null>(null)
  const [totalTokens, setTotalTokens] = useState<{input: number, output: number, total: number} | null>(null)
  
  // Ask AI state
  const [showAskAI, setShowAskAI] = useState(false)
  const [askAISessionId, setAskAISessionId] = useState<string | undefined>(undefined)
  
  // Offline mode state
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  // Function to show styled notifications (moved up so it can be used in error handlers)
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000) // Auto-hide after 3 seconds
  }

  // Prevent window from closing on errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      event.preventDefault();
      // Only show notification if it's not a network error
      if (!event.error?.message?.includes('fetch')) {
        showNotification('An error occurred but was handled gracefully.', 'error');
      }
      return true;
    };
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
      // Only show notification if it's not a network error
      if (!event.reason?.message?.includes('fetch')) {
        showNotification('An error occurred but was handled gracefully.', 'error');
      }
      return true;
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Color scheme management for popups
  useEffect(() => {
    const savedScheme = localStorage.getItem('colorScheme') as 'venice-blue' | 'dark-ocean' | 'lawrencium' | 'deep-space' | 'void-black' | 'yoda';
    if (savedScheme && (savedScheme === 'venice-blue' || savedScheme === 'dark-ocean' || savedScheme === 'lawrencium' || savedScheme === 'deep-space' || savedScheme === 'void-black' || savedScheme === 'yoda')) {
      // Remove any existing color scheme classes
      document.body.className = document.body.className.replace(/color-scheme-[\w-]+/g, '');
      // Add the current color scheme class
      document.body.classList.add(`color-scheme-${savedScheme}`);
    } else {
      // Default to void-black
      document.body.className = document.body.className.replace(/color-scheme-[\w-]+/g, '');
      document.body.classList.add('color-scheme-void-black');
    }
  }, []);

  // Function to remove strikeouts from text
  const removeStrikeouts = (text: string) => {
    // Remove struck-through content and clean up markdown strikeouts
    return text
      .replace(/~~([^~]+)~~/g, '') // Remove ~~strikeout~~ markdown
      .replace(/—+/g, '') // Remove em dashes
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
      .trim();
  }

  // Function to handle GPT refinement
  const handleRefinement = async () => {
    if (!refinementInput.trim()) {
      showNotification('Please enter refinement instructions', 'error');
      return;
    }

    // Prevent multiple simultaneous refinements
    if (isRefining) {
      return;
    }

    setIsRefining(true);
    
    try {
      // Check if window.electronAPI exists
      if (!window.electronAPI) {
        console.error('electronAPI not available');
        showNotification('API not available', 'error');
        setIsRefining(false);
        return;
      }
      
      // Get clean text without strikeouts
      const cleanText = removeStrikeouts(editedOutput || resultText);
      
      // Determine if we're in impression mode
      const isImpressionMode = mode === 'impression-only';
      
      // Read the appropriate refinement template
      const promptName = isImpressionMode ? 'refine_impression' : 'refine_report';
      console.log('Reading refinement prompt:', promptName);
      
      let refineTemplate;
      try {
        refineTemplate = await window.electronAPI.readPrompt(promptName);
      } catch (readError) {
        console.error('Error reading refinement template:', readError);
        showNotification('Could not read refinement template', 'error');
        setIsRefining(false);
        return;
      }
      
      if (!refineTemplate || refineTemplate.trim() === '') {
        console.error('Refinement template is empty or not found');
        showNotification('Refinement template not found', 'error');
        setIsRefining(false);
        return;
      }
      
      // Replace placeholders in the template
      const refinementPrompt = refineTemplate
        .replace('{{REFINEMENT_INPUT}}', refinementInput.trim())
        .replace(isImpressionMode ? '{{IMPRESSION_TEXT}}' : '{{REPORT_TEXT}}', cleanText);
      
      console.log('Calling generateReport with refinement prompt');
      
      // Call GPT API
      let response;
      try {
        response = await window.electronAPI.generateReport(refinementPrompt);
      } catch (apiError) {
        console.error('Error calling generateReport:', apiError);
        showNotification('Failed to generate refinement', 'error');
        setIsRefining(false);
        return;
      }
      
      if (response) {
        // Handle both old string format and new object format for backward compatibility
        const responseText = typeof response === 'string' ? response : response.text;
        const tokens = typeof response === 'string' ? null : response.tokens;
        
        // Store values before async updates
        const currentResult = resultText;
        const currentOriginal = originalResultText;
        
        // Store previous result for diff comparison
        setPreviousResultText(currentResult);
        
        // If this is the first refinement, store the original
        if (!currentOriginal) {
          setOriginalResultText(currentResult);
        }
        
        // Add current result to history before updating
        setRefinementHistory(prev => [...prev, currentResult]);
        
        // Clear redo history when new refinement is made
        setRedoHistory([]);
        
        // Update the result with the refined version
        setResultText(responseText);
        setEditedOutput(responseText);
        
        // Update token count if available (replace, not add)
        if (tokens) {
          setTotalTokens(tokens);
        }
        
        // Clear the refinement input
        setRefinementInput('');
        
        showNotification('Report refined successfully!', 'success');
      } else {
        showNotification('Failed to refine report', 'error');
      }
    } catch (error) {
      console.error('Refinement error:', error);
      showNotification(`Error during refinement: ${error?.message || error}`, 'error');
      // Prevent any window close on error
      if (error?.message?.includes('window') || error?.message?.includes('close')) {
        console.error('Window close prevented during refinement error');
        error.preventDefault?.();
      }
    } finally {
      setIsRefining(false);
    }
  }

  // Function to undo the last refinement
  const handleUndoRefinement = () => {
    if (refinementHistory.length === 0) {
      showNotification('No refinements to undo', 'error');
      return;
    }

    // Get the last version from history
    const lastVersion = refinementHistory[refinementHistory.length - 1];
    
    // Add current result to redo history before undoing
    setRedoHistory(prev => [...prev, resultText]);
    
    // Remove the last version from history
    setRefinementHistory(prev => prev.slice(0, -1));
    
    // Update states in sequence to prevent React DOM conflicts
    setTimeout(() => {
      // Set previous result for diff comparison
      if (refinementHistory.length > 1) {
        // If there are more items in history, use the second-to-last
        setPreviousResultText(refinementHistory[refinementHistory.length - 2]);
      } else {
        // If only one item in history, we're going back to original vs template comparison
        setPreviousResultText('');
      }
      
      // Restore the previous version
      setResultText(lastVersion);
      setEditedOutput(lastVersion);
      
      showNotification('Refinement undone', 'success');
    }, 10);
  }

  // Function to redo the last undone refinement
  const handleRedoRefinement = () => {
    if (redoHistory.length === 0) {
      showNotification('No refinements to redo', 'error');
      return;
    }

    // Get the last undone version from redo history
    const redoVersion = redoHistory[redoHistory.length - 1];
    
    // Add current result back to refinement history
    setRefinementHistory(prev => [...prev, resultText]);
    
    // Remove the version from redo history
    setRedoHistory(prev => prev.slice(0, -1));
    
    // Update states in sequence to prevent React DOM conflicts
    setTimeout(() => {
      // Set previous result for diff comparison
      setPreviousResultText(resultText);
      
      // Restore the redone version
      setResultText(redoVersion);
      setEditedOutput(redoVersion);
      
      showNotification('Refinement redone', 'success');
    }, 10);
  }

  // Function to open the logic editor for the current study type
  const handleOpenLogicEditor = async () => {
    console.log('🎯 handleOpenLogicEditor called, studyType:', studyType, 'user:', user?.id);
    
    if (!studyType) {
      showNotification('Study type not available for logic editing', 'error');
      return;
    }

    if (!user?.id) {
      showNotification('User authentication required for logic editing', 'error');
      return;
    }

    try {
      console.log('📤 Sending IPC message to open logic editor:', { userId: user.id, studyType });
      // Send message to main process to open logic editor
      const result = await window.electron?.ipcRenderer?.invoke('open-logic-editor', {
        userId: user.id,
        studyType: studyType
      });
      
      console.log('📨 IPC result:', result);
      showNotification(`✨ Opening logic editor for ${studyType}`, 'success');
    } catch (error) {
      console.error('❌ Error opening logic editor:', error);
      showNotification('Error opening logic editor', 'error');
    }
  }

  // Custom diff function that preserves paragraph formatting and normalizes whitespace
  const diffWordsWithParagraphs = (template: string, result: string) => {
    // Normalize whitespace function - collapse multiple spaces to single space
    const normalizeWhitespace = (text: string) => {
      return text.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
    };
    
    // Use regular word diff but post-process to clean up formatting issues
    const normalizedTemplate = normalizeWhitespace(template);
    const normalizedResult = normalizeWhitespace(result);
    const diffs = diffWordsWithSpace(normalizedTemplate, normalizedResult);
    
    // Post-process to fix formatting issues that create unwanted paragraphs
    const cleanedDiffs: any[] = [];
    
    for (let i = 0; i < diffs.length; i++) {
      const current = diffs[i];
      const next = diffs[i + 1];
      
      // Fix case where punctuation gets separated from words due to changes
      if (current.value.match(/^[.,:;!?]\s*$/) && !current.added && !current.removed) {
        // If punctuation follows a change, merge it with previous element if possible
        if (cleanedDiffs.length > 0) {
          const prev = cleanedDiffs[cleanedDiffs.length - 1];
          if (prev.added === current.added && prev.removed === current.removed) {
            prev.value += current.value;
            continue;
          }
        }
      }
      
      // Fix spacing issues around changes that can create unwanted line breaks
      if (current.value.trim() === '' && current.value.length > 1) {
        // Multiple spaces - normalize to single space unless it contains line breaks
        if (current.value.includes('\n')) {
          cleanedDiffs.push(current);
        } else {
          cleanedDiffs.push({ ...current, value: ' ' });
        }
        continue;
      }
      
      // Handle line breaks more carefully
      if (current.value.includes('\n')) {
        // Preserve existing line breaks but don't add extra ones
        cleanedDiffs.push(current);
        continue;
      }
      
      cleanedDiffs.push(current);
    }
    
    return cleanedDiffs;
  };

  // Improved diff computation with memoization and paragraph preservation
  const computedDiff = useMemo(() => {
    if (mode !== 'gpt-diff' || !resultText) return null;
    
    // If we have a previous result (refinement), compare against that instead of template
    const compareText = previousResultText || templateText;
    if (!compareText) return null;
    
    const template = compareText.trim();
    const result = resultText.trim();
    
    // Always use words mode with paragraph preservation
    const diffs = diffWordsWithParagraphs(template, result);
    
    return diffs;
  }, [mode, templateText, resultText, previousResultText]);

  // Enhanced diff styling with better contrast and readability
  const getPartStyle = (part: any) => {
    // Handle line breaks and paragraph breaks differently
    const isLineBreak = part.value.includes('\n');
    const isWhitespaceOnly = part.value.trim() === '';
    
    const baseStyle = {
      padding: isLineBreak || isWhitespaceOnly ? '0' : '2px 4px',
      margin: isLineBreak || isWhitespaceOnly ? '0' : '0 1px',
      borderRadius: isLineBreak || isWhitespaceOnly ? '0' : '3px',
      display: 'inline' as const, // Always use inline to prevent unwanted line breaks
      lineHeight: '1.4',
      fontSize: '14px',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap' as const,
      verticalAlign: 'baseline', // Ensure consistent alignment
    };

    if (part.added) {
      return {
        ...baseStyle,
        backgroundColor: isLineBreak || isWhitespaceOnly ? 'transparent' : '#0d4f2a',
        color: isLineBreak || isWhitespaceOnly ? '#e5e7eb' : '#4ade80',
        fontWeight: isLineBreak || isWhitespaceOnly ? 'normal' : '600',
        border: isLineBreak || isWhitespaceOnly ? 'none' : '1px solid #16a34a',
      };
    }
    
    if (part.removed) {
      return {
        ...baseStyle,
        backgroundColor: isLineBreak || isWhitespaceOnly ? 'transparent' : '#5c1f1f',
        color: isLineBreak || isWhitespaceOnly ? '#e5e7eb' : '#f87171',
        textDecoration: isLineBreak || isWhitespaceOnly ? 'none' : 'line-through',
        fontWeight: isLineBreak || isWhitespaceOnly ? 'normal' : '600',
        border: isLineBreak || isWhitespaceOnly ? 'none' : '1px solid #dc2626',
        opacity: isLineBreak || isWhitespaceOnly ? '1' : '0.8',
      };
    }
    
    return {
      ...baseStyle,
      backgroundColor: 'transparent',
      color: '#e5e7eb',
      border: 'none',
      margin: 0,
      padding: 0,
    };
  };


  const handleRemoveStrikeouts = () => {
    const editableDiv = document.querySelector('[contenteditable]');
    if (editableDiv) {
      // Remove struck-through spans (deleted content) while preserving other content
      const strikeoutSpans = editableDiv.querySelectorAll('span[style*="line-through"]');
      strikeoutSpans.forEach(span => span.remove());
      
      // Update the state with the current content after removing strikeouts
      // This preserves any manual edits the user made
      setEditedOutput((editableDiv as HTMLElement).innerText);
    }
  };

  // ✅ Supabase and user logic - Now using the offline version
  const supabaseTemplates = useSupabaseTemplatesWithOffline(user, mode === 'template-manager' || mode === 'logic-manager', isOfflineMode)
  const templates = shouldUseSupabase ? supabaseTemplates.templates : {}
  const saveTemplate = shouldUseSupabase ? supabaseTemplates.saveTemplate : () => {}
  const refetchTemplates = shouldUseSupabase ? supabaseTemplates.refetchTemplates : async () => {}

  useEffect(() => {
    // Load saved textbox sizes
    window.electronAPI?.getTextboxSize?.('diffBoxHeight').then(height => {
      if (height) setDiffBoxHeight(height);
    });
    window.electronAPI?.getTextboxSize?.('refinementBoxHeight').then(height => {
      if (height) setRefinementBoxHeight(height);
    });
    window.electronAPI?.getTextboxSize?.('mainTextareaHeight').then(height => {
      if (height) setMainTextareaHeight(height);
    });
    window.electronAPI?.getTextboxSize?.('feedbackBoxHeight').then(height => {
      if (height) setFeedbackBoxHeight(height);
    });

    window.electron?.ipcRenderer?.invoke('get-supabase-session')
      .then(session => {
        if (session) {
          console.log('🧠 Setting Supabase session in popup')
          supabase.auth.setSession(session)
        } else {
          console.warn('⚠️ No Supabase session received in popup')
        }
      })


    window.electronAPI?.onPopupContent((data) => {
  console.log('📥 popup-content received:', JSON.stringify(data, null, 2))
  console.log('📥 popup-content data type:', typeof data)
  console.log('📥 popup-content keys:', data ? Object.keys(data) : 'null/undefined')

  // Capture study type if available
  if (data?.studyType) {
    setStudyType(data.studyType)
  }
  
  // Capture generation time if available
  if (data?.generationTime) {
    setGenerationTime(data.generationTime)
  }
  
  // Capture token usage if available
  if (data?.totalTokens) {
    setTotalTokens(data.totalTokens)
  }
  
  if (data?.type === 'template-manager') {
    setShouldUseSupabase(true)
    setMode('template-manager')
    setIsOfflineMode(data.isOfflineMode || false)
  } else if (data?.type === 'logic-manager') {
    setShouldUseSupabase(true)
    setMode('logic-manager')
    setIsOfflineMode(data.isOfflineMode || false)
  } else if (data?.type === 'impression-only') {
    setMode('impression-only')
    setResultText(data.result || '')
    setEditedOutput(data.result || '')
  } else if (data?.type === 'report-only') {
    setMode('report-only')
    setResultText(data.result || '')
    setEditedOutput(data.result || '')
  } else if (data?.mode === 'template-viewer') {
    setMode('template-viewer')
    setStudyType(data.studyType || '')
    setTemplateText(data.template || '')
    setResultText('') // No result for template viewer
    setEditedOutput('')
  } else if (typeof data === 'object' && data.template && data.result) {
    // Check if showDiffView is explicitly set to false, otherwise default to true
    const shouldShowDiff = data.showDiffView !== false
    setShowDiffView(shouldShowDiff)
    setMode(shouldShowDiff ? 'gpt-diff' : 'report-only')
    setTemplateText(data.template)
    setResultText(data.result)
    setEditedOutput(data.result)
  } else if (data?.type === 'loading') {
  setMode('loading')
}
 else {
    setMode('unknown')
  }
})

    // Handle token updates separately
    window.electronAPI?.onPopupTokens?.((data) => {
      console.log('📊 popup-tokens received:', JSON.stringify(data, null, 2))
      
      if (data?.generationTime) {
        setGenerationTime(data.generationTime)
      }
      
      if (data?.totalTokens) {
        setTotalTokens(data.totalTokens)
      }
    })

    window.electronAPI?.onWindowFocus?.((focused) => {
      document.body.classList.toggle('radpal-focused', focused)
    })
  }, [])

  // Update edited output when result changes
  useEffect(() => {
    if (mode === 'gpt-diff' && resultText) {
      setEditedOutput(resultText);
    }
  }, [mode, resultText]);

  const windowControlButtons = (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        onClick={() => window.electron.ipcRenderer.send('minimize-popup')}
        style={{
          fontSize: '13px',
          width: 24,
          height: 24,
          borderRadius: 4,
          background: '#1c1e23',
          color: '#ccc',
          border: 'none'
          /* cursor removed */
        }}
      >
        –
      </button>
      <button
        onClick={() => window.electron.ipcRenderer.send('close-popup')}
        style={{
          fontSize: '13px',
          width: 24,
          height: 24,
          borderRadius: 4,
          background: '#E36756',
          color: '#fff',
          border: 'none',
          /* cursor removed */
        }}
      >
        ×
      </button>
    </div>
  )


  const renderContent = () => {

    if (mode === 'loading') {
  return (
    <div 
      className="popup-container"
      style={{
        height: '100vh',
        overflowY: 'auto'
      }}>
      <div 
        style={{
          height: '30px',
          backgroundColor: 'transparent',
          WebkitAppRegion: 'drag',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '10px'
        }}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          {windowControlButtons}
        </div>
      </div>
      <div style={{
        padding: '20px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '16px',
        color: '#1a202c',
        textShadow: 'none',
        paddingTop: '10px'
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 70px)'
        }}>
          <span style={{ 
            fontSize: 14, 
            opacity: 0.8,
            fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            color: '#1a202c',
            textShadow: 'none'
          }}>⟳ Generating...</span>
        </div>
      </div>
    </div>
  )
}


    if (mode === 'template-manager') {
      return (
        <div className="window-frame">
          <div style={{
            height: '100vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
          <div 
            style={{
              height: '30px',
              backgroundColor: 'transparent',
              WebkitAppRegion: 'drag',
              position: 'sticky',
              top: 0,
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingRight: '10px'
            }}
            onDoubleClick={(e) => e.preventDefault()}
          >
            <div style={{ WebkitAppRegion: 'no-drag' }}>
              {windowControlButtons}
            </div>
          </div>
          <div style={{ 
            padding: 20,
            fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '16px',
            color: '#1a202c',
            textShadow: 'none',
            paddingTop: '10px'
          }}>
          <TemplateManager
            templates={templates}
            isOfflineMode={isOfflineMode}
            onSave={(studyType, t, p, i) => {
console.log('💾 Attempting to save:', studyType)
saveTemplate(studyType, t, p, i)
  .then(() => showNotification('✓ Saved!', 'success'))
  .catch((err) => {
    console.error('❌ Save failed', err)
    showNotification('✗ Save failed', 'error')
  })
}}
            onSaveWithAgentLogic={async (studyType, template, agentLogic) => {
              console.log('💾 Attempting to save new study type with agent logic:', studyType)
              try {
                const result = await window.electron?.ipcRenderer?.invoke('save-template-with-agent-logic', {
                  userId: user?.id,
                  studyType,
                  template,
                  agentLogic
                })
                
                if (result?.success) {
                  showNotification(`✓ Created "${studyType}" successfully!`, 'success')
                  // Refresh templates to include the new study type
                  await refetchTemplates()
                } else {
                  throw new Error(result?.error || 'Save failed')
                }
              } catch (err) {
                console.error('❌ Save with agent logic failed', err)
                showNotification('✗ Failed to create study type', 'error')
                throw err
              }
            }}

          />
          </div>
        </div>
        </div>
      )
    }

    if (mode === 'template-viewer') {
      return (
        <div className="window-frame">
          <div style={{
            height: '100vh',
            overflowY: 'auto',
            backgroundColor: '#1e1f25',
            color: '#fff'
          }}>
            {/* Title Bar */}
            <div style={{
              height: '40px',
              backgroundColor: '#2a2d31',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 15px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#3ABC96'
              }}>
                📄 Template Viewer: {studyType}
              </div>
              <button
                onClick={() => window.close()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
              >
                ×
              </button>
            </div>
            
            {/* Template Content */}
            <div style={{
              padding: '20px',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                margin: 0,
                color: '#ccc',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {templateText || 'No template available'}
              </pre>
            </div>
            
            {/* Info Footer */}
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
              color: '#666',
              textAlign: 'center'
            }}>
              This is a read-only view of the template for {studyType}
            </div>
          </div>
        </div>
      )
    }

    if (mode === 'logic-manager') {
      return (
        <div className="window-frame">
          <div style={{
            height: '100vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
          <div 
            style={{
              height: '30px',
              backgroundColor: 'transparent',
              WebkitAppRegion: 'drag',
              position: 'sticky',
              top: 0,
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingRight: '10px'
            }}
            onDoubleClick={(e) => e.preventDefault()}
          >
            <div style={{ WebkitAppRegion: 'no-drag' }}>
              {windowControlButtons}
            </div>
          </div>
          <div style={{ 
            padding: 20,
            fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '16px',
            color: '#1a202c',
            textShadow: 'none',
            paddingTop: '10px'
          }}>
          <LogicManager
            templates={templates}
            onSave={(studyType, t, p, i) => {
console.log('💾 Attempting to save logic:', studyType)
saveTemplate(studyType, t, p, i)
  .then(() => showNotification('✓ Saved!', 'success'))
  .catch((err) => {
    console.error('❌ Save failed', err)
    showNotification('✗ Save failed', 'error')
  })
}}

          />
          </div>
        </div>
        </div>
      )
    }

    if (mode === 'gpt-diff') {
      return (
        <div 
          className="popup-container"
          style={{
            height: '100vh',
            overflowY: 'auto'
          }}>
          <div 
            style={{
          height: '30px',
          backgroundColor: 'transparent',
          WebkitAppRegion: 'drag',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '10px'
        }}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          {windowControlButtons}
        </div>
      </div>
      <div style={{ 
        padding: '20px', 
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        fontSize: '16px',
        color: '#1a202c',
        textShadow: 'none',
        paddingTop: '10px'
      }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <BlurCard>
              <button
                className="radpal-button radpal-button-remove"
                onClick={handleRemoveStrikeouts}
                style={{ border: 'none' }}
              >
                ✖ Remove Strikeouts
              </button>
            </BlurCard>
            
            {/* Diff is always in words mode now */}
          </div>





          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {generationTime && (
              <span style={{ 
                fontSize: 14, 
                color: '#fff',
                textShadow: 'none',
                fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}>
                Time: {generationTime}s
              </span>
            )}
            {totalTokens && (
              <span style={{ 
                fontSize: 14, 
                color: '#fff',
                textShadow: 'none',
                fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}>
                Tokens: {totalTokens.total.toLocaleString()}
              </span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BlurCard>
                <button
                  className="radpal-button radpal-button-impression"
                  onClick={() => navigator.clipboard.writeText(editedOutput || resultText)}
                  style={{ border: 'none' }}
                >
                  ↗ Copy to Clipboard
                </button>
              </BlurCard>
              <BlurCard>
                <button
                  onClick={() => {
                    setAskAISessionId(undefined) // Create new session
                    setShowAskAI(true)
                  }}
                  className="radpal-button"
                  style={{
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    width: '100%'
                  }}
                >
                  <MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Ask AI
                </button>
              </BlurCard>
            </div>
          </div>
        </div>
        </div>




        {/* Diff display */}
        <div
          key={`diff-${resultText.length}-${previousResultText.length}`}
          contentEditable
          suppressContentEditableWarning
          className="popup-diff-box"
          onInput={(e) => setEditedOutput(e.currentTarget.innerText)}
          style={{
            backgroundColor: '#1e1f25',
            border: 'none',
            borderRadius: '8px',
            padding: '16px',
            minHeight: '200px',
            maxHeight: '600px',
            height: `${diffBoxHeight}px`,
            resize: 'none',
            overflowY: 'auto',
            lineHeight: '1.6',
            fontSize: '14px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          onMouseUp={() => {
            // Save the height when resize is finished
            const element = document.querySelector('.popup-diff-box') as HTMLElement;
            if (element) {
              const newHeight = parseInt(getComputedStyle(element).height);
              if (newHeight !== diffBoxHeight) {
                setDiffBoxHeight(newHeight);
                window.electronAPI?.saveTextboxSize?.('diffBoxHeight', newHeight);
              }
            }
          }}
        >
          <div style={{ display: 'inline' }}>
            {isRefining ? (
              <span style={{ fontSize: 14, opacity: 0.8, color: '#fff' }}>⟳ Generating...</span>
            ) : (
              computedDiff?.map((part, i) => (
                <span key={`diff-${i}-${part.added ? 'add' : part.removed ? 'rem' : 'same'}`} style={getPartStyle(part)}>
                  {part.value}
                </span>
              )) || <span>No differences to show</span>
            )}
          </div>
        </div>

        {/* GPT Refinement Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: 80 
        }}>
          <div style={{ 
            width: '95%',
            position: 'relative'
          }}>
            {/* Refine button positioned at top-left */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              zIndex: 10,
              transform: 'translateY(-130%)',
              marginBottom: 20
            }}>
              <BlurCard>
                <button
                  onClick={handleRefinement}
                  disabled={isRefining || !refinementInput.trim()}
                  className="radpal-button radpal-button-impression"
                  style={{
                    opacity: (isRefining || !refinementInput.trim()) ? 0.5 : 1,
                    /* cursor removed */
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    fontSize: '12px',
                    padding: '4px 8px'
                  }}
                >
                  {isRefining ? 'Refining...' : 'Refine Report'}
                </button>
              </BlurCard>
            </div>
          
          <textarea
            value={refinementInput}
            onChange={(e) => setRefinementInput(e.target.value)}
            placeholder="Describe how you'd like to improve the report... (e.g., 'make it more concise', 'change tone to more assertive', 'add details about disc desiccation')"
            disabled={isRefining}
            className="popup-output-textarea"
            style={{
              width: '95%',
              minHeight: `${refinementBoxHeight}px`,
              height: `${refinementBoxHeight}px`,
              resize: 'none',
              padding: '16px',
              backgroundColor: '#1e1f25',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              margin: '0 auto',
              display: 'block',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onMouseUp={(e) => {
              // Save the height when resize is finished
              const newHeight = parseInt(getComputedStyle(e.currentTarget).height);
              if (newHeight !== refinementBoxHeight) {
                setRefinementBoxHeight(newHeight);
                window.electronAPI?.saveTextboxSize?.('refinementBoxHeight', newHeight);
              }
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {refinementHistory.length > 0 && (
                <BlurCard>
                  <button
                    onClick={handleUndoRefinement}
                    disabled={isRefining}
                    className="radpal-button radpal-button-remove"
                    style={{
                      opacity: isRefining ? 0.5 : 1,
                      /* cursor removed */
                      backgroundColor: 'transparent',
                      border: 'none'
                    }}
                  >
                    ↶ Undo
                  </button>
                </BlurCard>
              )}
              
              {redoHistory.length > 0 && (
                <BlurCard>
                  <button
                    onClick={handleRedoRefinement}
                    disabled={isRefining}
                    className="radpal-button radpal-button-impression"
                    style={{
                      opacity: isRefining ? 0.5 : 1,
                      /* cursor removed */
                      backgroundColor: 'transparent',
                      border: 'none'
                    }}
                  >
                    ↷ Redo
                  </button>
                </BlurCard>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* User Feedback Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: 80 
        }}>
          <div style={{ 
            width: '95%',
            position: 'relative'
          }}>
            {/* Apply Feedback button positioned at top-left */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              zIndex: 10,
              transform: 'translateY(-130%)',
              marginBottom: 20
            }}>
              <BlurCard>
                <button
                  onClick={handleOpenLogicEditor}
                  disabled={!studyType}
                  className="radpal-button radpal-button-impression"
                  style={{
                    opacity: !studyType ? 0.5 : 1,
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    fontSize: '12px',
                    padding: '4px 8px'
                  }}
                >
                  ⚡ Edit Logic
                </button>
              </BlurCard>
            </div>
          
          <textarea
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder="Click 'Edit Logic' to customize report generation rules..."
            disabled={isProcessingFeedback}
            className="popup-output-textarea"
            style={{
              width: '95%',
              minHeight: `${feedbackBoxHeight}px`,
              height: `${feedbackBoxHeight}px`,
              resize: 'none',
              padding: '16px',
              backgroundColor: '#1e1f25',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              margin: '0 auto',
              display: 'block',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onMouseUp={(e) => {
              // Save the height when resize is finished
              const newHeight = parseInt(getComputedStyle(e.currentTarget).height);
              if (newHeight !== feedbackBoxHeight) {
                setFeedbackBoxHeight(newHeight);
                window.electronAPI?.saveTextboxSize?.('feedbackBoxHeight', newHeight);
              }
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#1a202c',
              textShadow: 'none',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              {studyType ? `Study Type: ${studyType}` : 'Study type not detected'}
            </div>
          </div>
        </div>
      </div>
    </div>
      );
    }

    if (mode === 'impression-only' || mode === 'report-only') {
      return (
        <div 
          className="popup-container"
          style={{
            height: '100vh',
            overflowY: 'auto'
          }}>
          <div 
          style={{
          height: '30px',
          backgroundColor: 'transparent',
          WebkitAppRegion: 'drag',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingRight: '10px'
        }}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <div style={{ WebkitAppRegion: 'no-drag' }}>
          {windowControlButtons}
        </div>
      </div>
      <div
        style={{
          padding: '20px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#1a202c',
          textShadow: 'none',
          paddingTop: '10px'
        }}
      >
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {generationTime && (
              <span style={{ 
                fontSize: 14, 
                color: '#fff',
                textShadow: 'none',
                fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}>
                Time: {generationTime}s
              </span>
            )}
            {totalTokens && (
              <span style={{ 
                fontSize: 14, 
                color: '#fff',
                textShadow: 'none',
                fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}>
                Tokens: {totalTokens.total.toLocaleString()}
              </span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BlurCard>
                <button
                  className="radpal-button radpal-button-impression"
                  onClick={() => navigator.clipboard.writeText(editedOutput)}
                  style={{ border: 'none' }}
                >
                  ↗ Copy to Clipboard
                </button>
              </BlurCard>
              <BlurCard>
                <button
                  onClick={() => {
                    setAskAISessionId(undefined) // Create new session
                    setShowAskAI(true)
                  }}
                  className="radpal-button"
                  style={{
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    width: '100%'
                  }}
                >
                  <MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Ask AI
                </button>
              </BlurCard>
            </div>
          </div>
        </div>
        <DragTextEditor
          text={isRefining ? '⟳ Generating...' : editedOutput}
          onChange={(newText) => setEditedOutput(newText)}
          disabled={isRefining}
          className="popup-output-textarea"
          style={{
            marginBottom: '40px',
            opacity: isRefining ? 0.8 : 1,
            height: `${mainTextareaHeight}px`
          }}
          onMouseUp={(e) => {
            // Save the height when resize is finished
            const newHeight = parseInt(getComputedStyle(e.currentTarget).height);
            if (newHeight !== mainTextareaHeight) {
              setMainTextareaHeight(newHeight);
              window.electronAPI?.saveTextboxSize?.('mainTextareaHeight', newHeight);
            }
          }}
        />
        
        {/* GPT Refinement Section for impression/report-only modes */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: 80 
        }}>
          <div style={{ 
            width: '95%',
            position: 'relative'
          }}>
            {/* Refine button positioned at top-left */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              zIndex: 10,
              transform: 'translateY(-130%)',
              marginBottom: 20
            }}>
              <BlurCard>
                <button
                  onClick={handleRefinement}
                  disabled={isRefining || !refinementInput.trim()}
                  className="radpal-button radpal-button-impression"
                  style={{
                    opacity: (isRefining || !refinementInput.trim()) ? 0.5 : 1,
                    /* cursor removed */
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    fontSize: '12px',
                    padding: '4px 8px'
                  }}
                >
                  {isRefining ? 'Refining...' : `Refine ${mode === 'impression-only' ? 'Impression' : 'Report'}`}
                </button>
              </BlurCard>
            </div>
          
          <textarea
            value={refinementInput}
            onChange={(e) => setRefinementInput(e.target.value)}
            placeholder={`Describe how you'd like to improve the ${mode === 'impression-only' ? 'impression' : 'report'}... (e.g., 'make it more concise', 'change tone to more assertive', 'add details about disc desiccation')`}
            disabled={isRefining}
            className="popup-output-textarea"
            style={{
              backgroundColor: '#1e1f25',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              minHeight: `${refinementBoxHeight}px`,
              maxHeight: '200px',
              height: `${refinementBoxHeight}px`,
              resize: 'none',
              padding: '16px',
              marginBottom: '40px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onMouseUp={(e) => {
              // Save the height when resize is finished
              const newHeight = parseInt(getComputedStyle(e.currentTarget).height);
              if (newHeight !== refinementBoxHeight) {
                setRefinementBoxHeight(newHeight);
                window.electronAPI?.saveTextboxSize?.('refinementBoxHeight', newHeight);
              }
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {refinementHistory.length > 0 && (
                <BlurCard>
                  <button
                    onClick={handleUndoRefinement}
                    disabled={isRefining}
                    className="radpal-button radpal-button-remove"
                    style={{
                      opacity: isRefining ? 0.5 : 1,
                      /* cursor removed */
                      backgroundColor: 'transparent',
                      border: 'none'
                    }}
                  >
                    ↶ Undo
                  </button>
                </BlurCard>
              )}
              
              {redoHistory.length > 0 && (
                <BlurCard>
                  <button
                    onClick={handleRedoRefinement}
                    disabled={isRefining}
                    className="radpal-button radpal-button-impression"
                    style={{
                      opacity: isRefining ? 0.5 : 1,
                      /* cursor removed */
                      backgroundColor: 'transparent',
                      border: 'none'
                    }}
                  >
                    ↷ Redo
                  </button>
                </BlurCard>
              )}
            </div>
          </div>
          </div>
        </div>
        
        {/* User Feedback Section for impressions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: 80 
        }}>
          <div style={{ 
            width: '95%',
            position: 'relative'
          }}>
            {/* Apply Feedback button positioned at top-left */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              zIndex: 10,
              transform: 'translateY(-130%)',
              marginBottom: 20
            }}>
              <BlurCard>
                <button
                  onClick={handleOpenLogicEditor}
                  disabled={!studyType}
                  className="radpal-button radpal-button-impression"
                  style={{
                    opacity: !studyType ? 0.5 : 1,
                    backgroundColor: '#3ABC96',
                    border: 'none',
                    fontSize: '12px',
                    padding: '4px 8px'
                  }}
                >
                  ⚡ Edit Logic
                </button>
              </BlurCard>
            </div>
            
          <textarea
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder={`Click 'Edit Logic' to customize ${mode === 'impression-only' ? 'impression' : 'report'} generation rules...`}
            disabled={isProcessingFeedback}
            className="popup-output-textarea"
            style={{
              backgroundColor: '#1e1f25',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '18px',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              minHeight: `${feedbackBoxHeight}px`,
              maxHeight: '200px',
              height: `${feedbackBoxHeight}px`,
              resize: 'none',
              padding: '16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
            onMouseUp={(e) => {
              // Save the height when resize is finished
              const newHeight = parseInt(getComputedStyle(e.currentTarget).height);
              if (newHeight !== feedbackBoxHeight) {
                setFeedbackBoxHeight(newHeight);
                window.electronAPI?.saveTextboxSize?.('feedbackBoxHeight', newHeight);
              }
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#1a202c',
              textShadow: 'none',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              {studyType ? `Study Type: ${studyType}` : 'Study type not detected'}
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    );
  }


    return (
      <div style={{
        height: '100vh',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <div 
          style={{
            height: '30px',
            backgroundColor: 'transparent',
            WebkitAppRegion: 'drag',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingRight: '10px'
          }}
        >
          <div style={{ WebkitAppRegion: 'no-drag' }}>
            {windowControlButtons}
          </div>
        </div>
        <div style={{ 
          padding: 20, 
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#1a202c',
          textShadow: 'none',
          paddingTop: '10px'
        }}>
        <h3 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#1a202c',
          textShadow: 'none'
        }}>⚠ Unknown popup content</h3>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#1a202c',
          textShadow: 'none'
        }}>No matching content handler found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="window-frame">
      {renderContent()}
      
      {/* Styled notification overlay */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '60px',
          right: '20px',
          zIndex: 10001,
          backgroundColor: notification.type === 'success' ? '#0d4f2a' : '#5c1f1f',
          color: notification.type === 'success' ? '#4ade80' : '#f87171',
          border: notification.type === 'success' ? '1px solid #16a34a' : '1px solid #dc2626',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '16px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
          boxShadow: 'none',
          animation: 'slideIn 0.3s ease-out',
          maxWidth: '300px',
          wordBreak: 'break-word',
        }}>
          {notification.message}
        </div>
      )}
      
      {/* Ask AI Modal */}
      {showAskAI && user?.id && (
        <AskAI
          userId={user.id}
          studyType={studyType || ''}
          reportText={editedOutput || resultText}
          reportId={undefined}
          sessionId={askAISessionId}
          onClose={() => setShowAskAI(false)}
        />
      )}
      
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
