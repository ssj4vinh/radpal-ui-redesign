import React, { useState, useEffect } from 'react'
import { useReports } from '../hooks/useReports'
import type { ReportWithTracking } from '../hooks/useReports'
import { format } from 'date-fns'

interface ReportHistoryProps {
  onReportSelect?: (report: ReportWithTracking) => void
  studyType?: string
}

export const ReportHistory: React.FC<ReportHistoryProps> = ({
  onReportSelect,
  studyType
}) => {
  const {
    reports,
    loadUserReports,
    loadReportsByStudyType,
    deleteReport,
    searchReports,
    loading,
    error
  } = useReports()

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedReport, setSelectedReport] = useState<ReportWithTracking | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [reportCount, setReportCount] = useState(0)

  // Load reports count on mount and when study type changes
  useEffect(() => {
    // Always load reports to get the count
    if (studyType) {
      loadReportsByStudyType(studyType)
    } else {
      loadUserReports()
    }
  }, [studyType])

  // Update report count when reports change
  useEffect(() => {
    setReportCount(reports.length)
  }, [reports])

  // Reload reports when modal opens (to get fresh data)
  useEffect(() => {
    if (isOpen) {
      if (studyType) {
        loadReportsByStudyType(studyType)
      } else {
        loadUserReports()
      }
    }
  }, [isOpen])

  const handleSearch = () => {
    console.log('Search triggered with term:', searchTerm)
    if (searchTerm.trim()) {
      searchReports(searchTerm.trim())
    } else if (studyType) {
      loadReportsByStudyType(studyType)
    } else {
      loadUserReports()
    }
  }

  const handleReportSelect = (report: ReportWithTracking) => {
    setSelectedReport(report)
    onReportSelect?.(report)
  }

  const handleDelete = async (reportId: string) => {
    const success = await deleteReport(reportId)
    if (success) {
      setShowDeleteConfirm(null)
      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
      }
    }
  }

  const getReportPreview = (report: ReportWithTracking) => {
    const content = report.edited_result || report.initial_result
    return content.length > 150 ? content.substring(0, 150) + '...' : content
  }

  return (
    <>
      <button
        className="history-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        title="View saved reports"
      >
        📋 History ({reportCount})
      </button>

      {isOpen && (
        <div className="report-history-modal">
          <div className="modal-overlay" onClick={() => setIsOpen(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h2>Report History</h2>
              <button className="close-button" onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className="search-bar">
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch}>Search</button>
            </div>

            {error && (
              <div className="error-message">{error}</div>
            )}

            {loading ? (
              <div className="loading">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="no-reports">No reports found</div>
            ) : (
              <div className="reports-list">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`report-item ${selectedReport?.id === report.id ? 'selected' : ''}`}
                  >
                    <div className="report-header">
                      <div className="report-title">
                        <span className="study-type">{report.study_type}</span>
                        {report.isDirty && <span className="edited-badge">Edited</span>}
                      </div>
                      <div className="report-date">
                        {report.created_at && format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                    
                    <div className="report-preview">
                      <div className="findings-preview">
                        <strong>Findings Input (sent to API):</strong> {report.findings.substring(0, 150)}
                        {report.findings.length > 150 && '...'}
                      </div>
                      <div className="result-preview">
                        <strong>API Output (unedited):</strong> {report.initial_result.substring(0, 150)}
                        {report.initial_result.length > 150 && '...'}
                      </div>
                      {report.edited_result && (
                        <div className="edited-preview">
                          <strong>Edited Report:</strong> {report.edited_result.substring(0, 150)}
                          {report.edited_result.length > 150 && '...'}
                        </div>
                      )}
                    </div>

                    <div className="report-actions">
                      <button
                        className="view-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReportSelect(report)
                        }}
                      >
                        View
                      </button>
                      {showDeleteConfirm === report.id ? (
                        <>
                          <button
                            className="confirm-delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(report.id!)
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            className="cancel-delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(null)
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteConfirm(report.id!)
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        /* Define color variables for both themes */
        [data-theme='light'] {
          --color-background: #ffffff;
          --color-surface: #f9fafb;
          --color-surface-hover: #f3f4f6;
          --color-surface-selected: #eff6ff;
          --color-text: #1f2937;
          --color-text-secondary: #6b7280;
          --color-border: #e5e7eb;
          --color-primary: #3b82f6;
          --color-primary-hover: #2563eb;
        }
        
        [data-theme='dark'] {
          --color-background: #1f2937;
          --color-surface: #374151;
          --color-surface-hover: #4b5563;
          --color-surface-selected: #1e3a8a;
          --color-text: #f3f4f6;
          --color-text-secondary: #9ca3af;
          --color-border: #4b5563;
          --color-primary: #60a5fa;
          --color-primary-hover: #93bbfc;
        }
        
        .history-toggle-button {
          padding: 8px 16px;
          background: var(--color-surface);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
          position: relative;
          z-index: 101;
          -webkit-app-region: no-drag;
        }

        .history-toggle-button:hover {
          background: var(--color-surface-hover);
        }

        .report-history-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1;
        }

        .modal-content {
          position: relative;
          width: 90%;
          max-width: 900px;
          height: 85vh;
          max-height: 85vh;
          background: var(--color-background, #ffffff);
          color: var(--color-text, #1f2937);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          z-index: 2;
        }

        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: var(--color-text);
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--color-text-secondary, #6b7280);
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 3;
          transition: all 0.2s;
        }
        
        .close-button:hover {
          color: var(--color-text, #1f2937);
          transform: scale(1.1);
        }

        .search-bar {
          padding: 16px 20px;
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--color-border);
        }

        .search-bar input {
          flex: 1;
          padding: 8px 12px;
          background: var(--color-surface);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          font-size: 14px;
        }

        .search-bar button {
          padding: 8px 20px;
          background: var(--color-primary, #3b82f6);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          position: relative;
          z-index: 2;
          transition: all 0.2s;
        }
        
        .search-bar button:hover {
          background: var(--color-primary-hover, #2563eb);
          transform: translateY(-1px);
        }

        .error-message {
          padding: 12px 20px;
          background: #fee;
          color: #c00;
          font-size: 14px;
        }

        .loading, .no-reports {
          padding: 40px;
          text-align: center;
          color: var(--color-text-secondary);
        }

        .reports-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          pointer-events: auto;
        }

        .report-item {
          padding: 16px;
          margin-bottom: 12px;
          background: var(--color-surface, #f9fafb);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          transition: all 0.2s;
          position: relative;
          z-index: 1;
        }

        .report-item:hover {
          border-color: var(--color-primary, #3b82f6);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          background: var(--color-surface-hover, #f3f4f6);
        }

        .report-item.selected {
          border-color: var(--color-primary, #3b82f6);
          background: var(--color-surface-selected, #eff6ff);
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .report-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .study-type {
          font-weight: 600;
          color: var(--color-primary);
        }

        .edited-badge {
          padding: 2px 6px;
          background: #3b82f6;
          color: white;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 500;
        }

        .report-date {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .report-preview {
          margin-bottom: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .findings-preview, .result-preview {
          margin-bottom: 6px;
          color: var(--color-text-secondary);
        }

        .findings-preview strong, .result-preview strong {
          color: var(--color-text);
        }

        .report-actions {
          display: flex;
          gap: 8px;
        }

        .view-button, .delete-button, .confirm-delete, .cancel-delete {
          padding: 4px 12px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 13px;
          position: relative;
          z-index: 2;
          transition: all 0.2s;
        }

        .view-button {
          background: var(--color-primary, #3b82f6);
          color: white;
        }
        
        .view-button:hover {
          background: var(--color-primary-hover, #2563eb);
          transform: translateY(-1px);
        }

        .delete-button {
          background: #ef4444;
          color: white;
        }
        
        .delete-button:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .confirm-delete {
          background: #dc2626;
          color: white;
        }
        
        .confirm-delete:hover {
          background: #b91c1c;
        }

        .cancel-delete {
          background: var(--color-surface, #ffffff);
          color: var(--color-text, #1f2937);
          border: 1px solid var(--color-border, #e5e7eb);
        }
        
        .cancel-delete:hover {
          background: var(--color-surface-hover, #f9fafb);
        }
      `}</style>
    </>
  )
}