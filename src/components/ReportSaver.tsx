import React, { useState, useEffect } from 'react'
import { useReports } from '../hooks/useReports'
import type { ReportWithTracking } from '../hooks/useReports'
import { formatDistanceToNow } from 'date-fns'

interface ReportSaverProps {
  studyType: string
  originalFindings: string // What was sent to API
  apiOutput: string | null // What API returned (unedited)
  currentText: string // What's currently in the editor
  modelUsed?: string
  tokensUsed?: { input: number; output: number; total: number }
  promptUsed?: string
  onReportSaved?: (report: ReportWithTracking) => void
  onReset?: () => void // Callback for reset button
  initialDiffText?: string | null // The initial diff text shown to user (with strikeouts)
}

export const ReportSaver: React.FC<ReportSaverProps> = ({
  studyType,
  originalFindings,
  apiOutput,
  currentText,
  modelUsed,
  tokensUsed,
  promptUsed,
  onReportSaved,
  onReset,
  initialDiffText
}) => {
  const {
    currentReport,
    saveReport,
    updateReport,
    setCurrentReport
  } = useReports()
  
  const [isSaving, setIsSaving] = useState(false)
  const [userFeedback, setUserFeedback] = useState('')
  const [feedbackSkipped, setFeedbackSkipped] = useState(false)

  // Check dataset completion status
  const hasFindings = originalFindings && originalFindings.trim().length > 0
  const hasApiOutput = apiOutput && apiOutput.trim().length > 0
  
  // For Phase 3: Check if the current text differs from what was initially shown
  // If we have initialDiffText (report generation with diff), compare against that
  // Otherwise compare against the raw API output (impression generation)
  const compareText = initialDiffText || apiOutput || ''
  const isEdited = hasApiOutput && 
                   currentText && 
                   currentText.trim().length > 0 && 
                   compareText &&
                   currentText.trim() !== compareText.trim()
  
  // Phase 4: Check if feedback is provided or explicitly skipped
  const hasFeedback = userFeedback && userFeedback.trim().length > 0
  const feedbackComplete = hasFeedback || feedbackSkipped
  
  // Dataset is complete when we have first three pieces and feedback is either provided or skipped
  const isDatasetComplete = hasFindings && hasApiOutput && isEdited && feedbackComplete
  
  // Check if current dataset is already saved (and if the edited version matches)
  const isAlreadySaved = currentReport !== null && currentReport.edited_result === currentText

  // Save complete dataset - only when user clicks save button
  const handleSaveDataset = async () => {
    if (!isDatasetComplete) {
      console.warn('Dataset not complete, cannot save');
      return
    }

    console.log('📝 Saving dataset with', hasFeedback ? 'feedback' : 'skipped feedback');
    console.log('Prompt being saved:', promptUsed ? `${promptUsed.length} chars` : 'No prompt');
    
    setIsSaving(true)
    
    try {
      // Save all phases at once when user clicks save
      // Pass feedback if provided, or indicate it was skipped
      const feedbackToSave = hasFeedback ? userFeedback : (feedbackSkipped ? '[No feedback provided]' : '')
      
      const report = await saveReport(
        studyType,
        originalFindings, // Phase 1: What we sent to API
        apiOutput!, // Phase 2: What API returned (unedited)
        modelUsed,
        tokensUsed,
        promptUsed,
        feedbackToSave // Pass feedback (optional)
      )
      
      if (report) {
        // Immediately update with the edited version (Phase 3)
        const updateSuccess = await updateReport(report.id!, currentText, feedbackToSave)
        
        if (updateSuccess) {
          onReportSaved?.(report)
          console.log('✅ Complete dataset saved with', hasFeedback ? 'feedback' : 'skipped feedback')
          setUserFeedback('') // Clear feedback after saving
          setFeedbackSkipped(false) // Reset feedback skip state
        }
      }
    } catch (error) {
      console.error('Failed to save dataset:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="report-saver">
      <div className="report-saver-header">
        <div className="triplet-status">
          <h3>Dataset Collection Status</h3>
          <div className="status-indicators">
            <div className={`indicator ${hasFindings ? 'complete' : 'incomplete'}`}>
              <span className="indicator-icon">{hasFindings ? '✓' : '○'}</span>
              <span className="indicator-label">1. Findings Input</span>
            </div>
            <div className={`indicator ${hasApiOutput ? 'complete' : 'incomplete'}`}>
              <span className="indicator-icon">{hasApiOutput ? '✓' : '○'}</span>
              <span className="indicator-label">2. AI Output</span>
            </div>
            <div className={`indicator ${isEdited ? 'complete' : 'incomplete'}`}>
              <span className="indicator-icon">{isEdited ? '✓' : '○'}</span>
              <span className="indicator-label">3. Edited Result</span>
              {hasApiOutput && !isEdited && (
                <span className="indicator-hint">(needs editing)</span>
              )}
            </div>
            <div className={`indicator ${feedbackComplete ? 'complete' : 'incomplete'}`}>
              <span className="indicator-icon">{feedbackComplete ? '✓' : '○'}</span>
              <span className="indicator-label">4. Feedback</span>
              {isEdited && !feedbackComplete && (
                <span className="indicator-hint">(optional)</span>
              )}
              {feedbackSkipped && (
                <span className="indicator-hint" style={{ color: '#f59e0b' }}>(skipped)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Input Section - Phase 4 */}
      {isEdited && !feedbackSkipped && (
        <div className="feedback-section">
          <h4>Step 4: Describe Issues (optional)</h4>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            What issues did you notice with the AI-generated output that required correction?
          </p>
          <textarea
            value={userFeedback}
            onChange={(e) => {
              setUserFeedback(e.target.value)
              setFeedbackSkipped(false) // Reset skip state when user starts typing
            }}
            placeholder="Describe the issues: e.g., Missing key findings, incorrect terminology, wrong formatting, hallucinations, etc."
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: hasFeedback ? '1px solid var(--color-success)' : '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {hasFeedback && (
              <div style={{ fontSize: '12px', color: 'var(--color-success)' }}>
                ✓ Feedback provided
              </div>
            )}
            {!hasFeedback && (
              <button
                onClick={() => {
                  setFeedbackSkipped(true)
                  setUserFeedback('') // Clear any partial feedback
                }}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#d97706'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f59e0b'
                }}
              >
                Skip Feedback
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Show skipped feedback message */}
      {isEdited && feedbackSkipped && (
        <div className="feedback-section">
          <div style={{ 
            padding: '12px', 
            backgroundColor: 'var(--color-bg-secondary)', 
            borderRadius: '4px',
            border: '1px solid #f59e0b'
          }}>
            <div style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '4px' }}>
              ✓ Feedback skipped
            </div>
            <button
              onClick={() => {
                setFeedbackSkipped(false)
                setUserFeedback('')
              }}
              style={{
                padding: '4px 12px',
                backgroundColor: 'transparent',
                color: '#f59e0b',
                border: '1px solid #f59e0b',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Add Feedback
            </button>
          </div>
        </div>
      )}

      <div className="report-saver-actions">
        <div className="report-actions">
          {/* Save Dataset Button - only enabled when complete */}
          <button
            className={`save-button ${isAlreadySaved ? 'saved' : isDatasetComplete ? 'primary' : 'disabled'}`}
            onClick={handleSaveDataset}
            disabled={!isDatasetComplete || isSaving || isAlreadySaved}
            title={
              isAlreadySaved
                ? 'Dataset already saved'
                : !isDatasetComplete 
                ? 'Complete requirements: 1) Enter findings and generate report, 2) Review AI output, 3) Edit the output, 4) Optionally provide or skip feedback' 
                : 'Save complete dataset'
            }
          >
            {isSaving ? 'Saving Dataset...' : 
             isAlreadySaved ? '✓ Dataset Saved' :
             isDatasetComplete ? 'Save Complete Dataset' : 
             'Complete All Requirements to Save'}
          </button>

          {/* Reset Button */}
          <button
            className="reset-button"
            onClick={onReset}
            title="Clear current dataset and start fresh"
          >
            Reset for New Dataset
          </button>
        </div>
      </div>

      <style>{`
        .report-saver {
          padding: 16px;
          background: var(--color-surface);
          border-radius: 8px;
          margin-bottom: 16px;
          border: 2px solid var(--color-border);
        }

        .report-saver-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
        }

        .triplet-status {
          flex: 1;
          min-width: 300px;
        }

        .triplet-status h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
        }

        .status-indicators {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          transition: all 0.2s;
        }

        .indicator.complete {
          background: #10b98115;
          border-color: #10b981;
        }

        .indicator.incomplete {
          background: var(--color-background);
          border-color: var(--color-border);
          opacity: 0.7;
        }

        .indicator-icon {
          font-size: 16px;
          font-weight: bold;
        }

        .indicator.complete .indicator-icon {
          color: #10b981;
        }

        .indicator.incomplete .indicator-icon {
          color: var(--color-text-secondary);
        }

        .indicator-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }

        .indicator-hint {
          font-size: 11px;
          color: #f59e0b;
          margin-left: 4px;
        }

        .report-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .save-button, .reset-button {
          padding: 8px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .save-button.primary {
          background: #10b981;
          color: white;
        }
        
        .save-button.saved {
          background: #059669;
          color: white;
          cursor: not-allowed;
          opacity: 0.9;
        }

        .save-button.disabled {
          background: var(--color-surface);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
          cursor: not-allowed;
        }

        .save-button:hover:not(:disabled):not(.disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reset-button {
          background: #ef4444;
          color: white;
        }

        .reset-button:hover {
          background: #dc2626;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .feedback-section {
          margin-top: 16px;
          padding: 16px;
          background: var(--color-bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .feedback-section h4 {
          margin: 0 0 8px 0;
          color: var(--color-primary);
          font-size: 16px;
        }

        .report-saver-actions {
          margin-top: 16px;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}