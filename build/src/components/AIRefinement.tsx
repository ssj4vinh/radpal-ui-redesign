import React, { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, RefreshCw, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { sendChat } from '../lib/chat/sendChat'
import * as diff from 'diff'

interface AIRefinementProps {
  originalText: string
  studyType: string
  isImpression?: boolean
  onClose: () => void
  onAccept?: (refinedText: string) => void
  onUpdateOriginal?: (newText: string) => void
}

const standardRefinementPrompt = `You are a radiology report editor. Your job is to REFINE the wording of the report to be clearer, tighter, and more professional while strictly preserving the template structure and the factual content.

HARD RULES (do not violate)

Do NOT add new findings, impressions, measurements, or differentials.
Do NOT remove existing clinically relevant content or negate anything stated.
Do NOT change laterality, levels, grades, or measurements (keep all numbers/units exactly).
Do NOT reorder or rename sections or subsections provided by the user's template.
Do NOT change the exam, technique, history, or comparison text (verbatim pass-through).
Do NOT infer diagnoses beyond what is already stated.

WHAT YOU MAY CHANGE

Reword sentences for clarity, brevity, and consistency.
Standardize terminology (e.g., use "stenosis" consistently rather than "narrowing" unless the original used a specific term that must be kept).
Improve parallel structure, reduce redundancy, and fix grammar/punctuation.
Convert ambiguous phrases to precise, template-consistent phrasing without changing meaning.
Normalize formatting of levels (e.g., L3–4, C5–6), sizes (e.g., 1.1 × 0.6 × 0.9 cm), and lists.
Where the user uses variable words for the same severity across the report, standardize to a single severity scale (mild / moderate / severe) without changing the severity itself.

OUTPUT FORMAT (very important)

Output ONLY the refined report, with the exact same section headings and order as the input template.
Preserve all sections and subsections (including "FINDINGS/IMPRESSION" or level-by-level items).
Keep all numeric values, units, and anatomical levels unchanged.
If the input uses a single combined section (e.g., "FINDINGS/IMPRESSION"), keep it combined.
Maintain any bulleting or level-by-level formatting exactly; rewrite only the sentence wording.

QUALITY CHECK BEFORE YOU OUTPUT (silently apply)

All numbers, levels, and laterality unchanged? (Yes)
No new content introduced or content removed? (Yes)
Section headings and order identical? (Yes)
Technique/history/comparison unchanged verbatim? (Yes)
Grammar, parallel structure, and consistency improved? (Yes)

Now refine the following report. Remember: keep headings/structure identical and change only the wording for clarity.

<<<REPORT_START
{REPORT_TEXT}
REPORT_END>>>`

const conservativeRefinementPrompt = `You are a radiology report editor running in CONSERVATIVE mode.

GOAL
Refine wording ONLY when it yields a substantive clarity, correctness, or consistency improvement. Preserve the author's style and sentence boundaries. If a sentence is already clear, standard, and concise, LEAVE IT UNCHANGED.

HARD RULES

* Do NOT add, remove, or infer findings. Do NOT change laterality, levels, grades, or measurements.
* Do NOT reorder or rename sections. Do NOT change the exam/technique/history/comparison text.
* Keep sentence boundaries: DO NOT merge adjacent sentences or split sentences unless fixing a true error.
* Keep bullet/line structure and level-by-level formatting exactly as provided.

EDIT-ONLY-WHEN (must meet ≥1 of these)

1. Fix a grammar/punctuation error.
2. Resolve ambiguity or contradiction.
3. Standardize terminology to the SAME term used elsewhere in the report (e.g., "stenosis" vs "narrowing"), without changing severity.
4. Remove true redundancy (exact repetition) without losing information.
5. Correct formatting of levels (e.g., L3–4), units, dimensions (×), or spacing.

DO-NOT-TOUCH PHRASES (unless incorrect in context)
"unremarkable", "intact", "normal", "preserved", "maintained", "no acute fracture", "no significant …"
Example: Do NOT change "Meniscus is unremarkable. The articular surfaces are intact." to a combined sentence. Keep both sentences as written.

CHANGE BUDGET

* Edit at most 20% of sentences in FINDINGS and 80% in IMPRESSION.
* If unsure whether an edit helps, DO NOT EDIT.

OUTPUT

* Output ONLY the refined report with IDENTICAL section headings and order.
* Keep all numbers/units/levels exactly the same.

QUALITY CHECK (silently ensure before output)

* Numbers/levels/laterality unchanged.
* Section names/order unchanged.
* ≤25% sentences altered in the findings section. ≤80% sentences altered in the impression section.
* No sentence merging unless fixing an error.
* No micro-edits that merely rephrase equivalent statements.

Now refine the following report under these rules:

<<<REPORT_START
{REPORT_TEXT}
REPORT_END>>>`


// Helper function to strip HTML and convert to plain text
function stripHtml(html: string): string {
  // Replace <br> tags with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove all HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  text = textarea.value;
  
  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2
  text = text.trim();
  
  return text;
}

export default function AIRefinement({
  originalText,
  studyType,
  isImpression = false,
  onClose,
  onAccept,
  onUpdateOriginal
}: AIRefinementProps) {
  const [refinedText, setRefinedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedOriginal, setCopiedOriginal] = useState(false)
  const [copiedRefined, setCopiedRefined] = useState(false)
  // Strip HTML from the original text
  const cleanOriginalText = stripHtml(originalText)
  const [editableOriginal, setEditableOriginal] = useState(cleanOriginalText)
  const [editableRefined, setEditableRefined] = useState('')
  // Load conservative mode preference from localStorage
  const [conservativeMode, setConservativeMode] = useState(() => {
    const saved = localStorage.getItem('aiRefinementConservativeMode')
    return saved !== null ? saved === 'true' : true // Default to true if not set
  })
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null)
  const rightTextareaRef = useRef<HTMLDivElement>(null)

  // Save conservative mode preference to localStorage
  const handleConservativeModeChange = (checked: boolean) => {
    setConservativeMode(checked)
    localStorage.setItem('aiRefinementConservativeMode', String(checked))
  }
  
  // Generate on first mount
  useEffect(() => {
    generateRefinement()
  }, [])
  
  // Update contentEditable when editableRefined changes (from API or remove strikeouts)
  useEffect(() => {
    if (rightTextareaRef.current && editableRefined) {
      // Only update if the content is different to avoid cursor issues
      if (rightTextareaRef.current.innerHTML !== editableRefined) {
        rightTextareaRef.current.innerHTML = editableRefined
      }
    }
  }, [editableRefined])

  const generateRefinement = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const selectedModel = await window.electronAPI?.getSelectedModel?.() || 'claude-3-sonnet'
      
      // Use the edited text if available, otherwise use the cleaned original
      const textToRefine = editableOriginal || cleanOriginalText
      
      // Ensure the text is clean (no HTML)
      const cleanTextToRefine = stripHtml(textToRefine)
      
      // Prepare the message with the appropriate refinement prompt
      const refinementPrompt = conservativeMode ? conservativeRefinementPrompt : standardRefinementPrompt
      const promptWithText = refinementPrompt.replace('{REPORT_TEXT}', cleanTextToRefine)
      
      const messages = [
        { role: 'user' as const, content: promptWithText }
      ]
      
      const response = await sendChat(messages, selectedModel)
      
      if (response.error) {
        throw new Error(response.error)
      }

      if (response.text) {
        setRefinedText(response.text)
        // Generate HTML diff for editable view
        const diffHtml = generateDiffHtml(cleanTextToRefine, response.text)
        setEditableRefined(diffHtml)
      } else {
        throw new Error('No response received')
      }
    } catch (err) {
      console.error('Failed to generate refinement:', err)
      setError('Failed to generate refinement. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (text: string, isOriginal: boolean) => {
    let textToCopy = text
    
    // If copying refined text, extract plain text from HTML
    if (!isOriginal && text.includes('<')) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = text
      textToCopy = tempDiv.textContent || tempDiv.innerText || ''
    }
    
    navigator.clipboard.writeText(textToCopy)
    if (isOriginal) {
      setCopiedOriginal(true)
      setTimeout(() => setCopiedOriginal(false), 2000)
    } else {
      setCopiedRefined(true)
      setTimeout(() => setCopiedRefined(false), 2000)
    }
  }

  const handleRemoveStrikeouts = (isOriginal: boolean) => {
    if (isOriginal) {
      const text = editableOriginal
      // Remove struck-through text (text between ~~ markers) and clean up spacing
      let cleanedText = text.replace(/~~[^~]+~~/g, '')
      cleanedText = cleanedText.replace(/  +/g, ' ')
      cleanedText = cleanedText.replace(/\n\n+/g, '\n\n')
      setEditableOriginal(cleanedText)
    } else {
      // For refined text, we need to remove HTML spans with strikethrough
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = editableRefined
      
      // Remove all elements with strikethrough style
      const strikethroughElements = tempDiv.querySelectorAll('[style*="line-through"]')
      strikethroughElements.forEach(el => el.remove())
      
      // Get the cleaned HTML
      let cleanedHtml = tempDiv.innerHTML
      
      // Clean up any double spaces or breaks
      cleanedHtml = cleanedHtml.replace(/(&nbsp;)+/g, ' ')
      cleanedHtml = cleanedHtml.replace(/(<br\s*\/?>){3,}/g, '<br><br>')
      
      setEditableRefined(cleanedHtml)
    }
  }
  
  // Generate HTML diff with styled spans (like main UI)
  const generateDiffHtml = (original: string, refined: string): string => {
    const changes = diff.diffWords(original, refined)
    let diffHtml = ''
    
    changes.forEach(part => {
      // Escape HTML in the text
      const partHtml = part.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
      
      if (part.removed) {
        // Red strikethrough for removed text
        diffHtml += `<span style="background-color: rgba(227, 103, 86, 0.3); color: #E36756; text-decoration: line-through; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`
      } else if (part.added) {
        // Green background for added text
        diffHtml += `<span style="background-color: rgba(58, 188, 150, 0.3); color: #3ABC96; padding: 1px 2px; border-radius: 2px;">${partHtml}</span>`
      } else {
        // Unchanged text
        diffHtml += partHtml
      }
    })
    
    return diffHtml
  }

  const handleAcceptClean = () => {
    // Remove all strikethrough formatting and accept the refined version
    const cleanedText = editableRefined.replace(/~~[^~]+~~/g, '')
    if (onAccept) {
      onAccept(cleanedText)
    }
    onClose()
  }

  const handleClosePanel = (isLeft: boolean) => {
    if (isLeft) {
      setShowLeftPanel(false)
      // Move refined text to be the new original for further refinement
      if (onUpdateOriginal) {
        onUpdateOriginal(editableRefined)
      }
    } else {
      setShowRightPanel(false)
      // Keep original text as is
      if (onUpdateOriginal) {
        onUpdateOriginal(editableOriginal)
      }
    }
    
    // If only one panel remains, close the refinement view after a brief delay
    setTimeout(() => {
      if (!showLeftPanel || !showRightPanel) {
        onClose()
      }
    }, 100)
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
      zIndex: 1000,
      padding: isFullscreen ? 0 : '20px'
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: isFullscreen ? 0 : '12px',
        width: isFullscreen ? '100%' : '95%',
        height: isFullscreen ? '100%' : '90%',
        maxWidth: isFullscreen ? '100%' : '1600px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#242424'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
              AI Refinement {isImpression ? '(Impression)' : '(Report)'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Compare original and refined versions side by side
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '12px',
              color: '#ffffff',
              padding: '6px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={conservativeMode}
                onChange={(e) => handleConservativeModeChange(e.target.checked)}
                style={{
                  cursor: 'pointer'
                }}
              />
              Conservative Mode
            </label>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px',
                cursor: 'pointer',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center'
              }}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px',
                cursor: 'pointer',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Left Panel - Original */}
          {showLeftPanel && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRight: showRightPanel ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              position: 'relative'
            }}>
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#2a2a2a',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>
                  Original
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={generateRefinement}
                    disabled={isLoading}
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      color: '#3B82F6',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: isLoading ? 0.5 : 1
                    }}
                    title="Regenerate refinement with current text"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    Refine
                  </button>
                  <button
                    onClick={() => handleCopy(editableOriginal, true)}
                    style={{
                      background: copiedOriginal ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: copiedOriginal ? '#22C55E' : '#ffffff',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiedOriginal ? <Check size={14} /> : <Copy size={14} />}
                    {copiedOriginal ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleRemoveStrikeouts(true)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                    title="Remove strikethrough text"
                  >
                    Clean
                  </button>
                  {showRightPanel && (
                    <button
                      onClick={() => handleClosePanel(true)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#ffffff'
                      }}
                      title="Close left panel"
                    >
                      <ChevronLeft size={14} />
                    </button>
                  )}
                </div>
              </div>
              <textarea
                ref={leftTextareaRef}
                value={editableOriginal}
                onChange={(e) => setEditableOriginal(e.target.value)}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: '#1a1a1a',
                  color: '#ffffff',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  resize: 'none'
                }}
              />
            </div>
          )}

          {/* Right Panel - Refined */}
          {showRightPanel && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#2a2a2a',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 500, 
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  Refined
                  {isLoading && (
                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      (Generating...)
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleCopy(editableRefined, false)}
                    disabled={!editableRefined}
                    style={{
                      background: copiedRefined ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: !editableRefined ? 'not-allowed' : 'pointer',
                      color: copiedRefined ? '#22C55E' : '#ffffff',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: !editableRefined ? 0.5 : 1
                    }}
                  >
                    {copiedRefined ? <Check size={14} /> : <Copy size={14} />}
                    {copiedRefined ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleRemoveStrikeouts(false)}
                    disabled={!editableRefined}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: !editableRefined ? 'not-allowed' : 'pointer',
                      color: '#ffffff',
                      fontSize: '12px',
                      opacity: !editableRefined ? 0.5 : 1
                    }}
                    title="Remove strikethrough text"
                  >
                    Remove Strikeouts
                  </button>
                  {showLeftPanel && (
                    <button
                      onClick={() => handleClosePanel(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px',
                        cursor: 'pointer',
                        color: '#ffffff'
                      }}
                      title="Close right panel"
                    >
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Always show editable div with HTML diff */}
              <div
                ref={rightTextareaRef}
                contentEditable={!isLoading}
                onInput={(e) => {
                  // Update state without re-rendering the contentEditable
                  setEditableRefined(e.currentTarget.innerHTML)
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: '#2a2a2a',
                  color: error ? '#EF4444' : '#f0f0f0',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  overflow: 'auto',
                  opacity: isLoading ? 0.6 : 1,
                  cursor: isLoading ? 'not-allowed' : 'text',
                  minHeight: '200px'
                }}
                suppressContentEditableWarning={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}