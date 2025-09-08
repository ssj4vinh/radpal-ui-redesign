import React, { useState, useEffect } from 'react'
import { Download, AlertCircle, CheckCircle, X } from 'lucide-react'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseName?: string
  releaseDate?: string
}

interface UpdateCheckerProps {
  onComplete: () => void
}

export default function UpdateChecker({ onComplete }: UpdateCheckerProps) {
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'none'>('checking')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribers: (() => void)[] = []

    // Set up update event listeners
    const setupListeners = async () => {
      // Listen for update available
      if (window.electronAPI?.onUpdateAvailable) {
        const unsubAvailable = window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
          // Don't log the entire object to avoid console clutter
          if (info?.version) {
            console.log(`Update available: v${info.version}`)
          }
          setUpdateInfo(info)
          setUpdateStatus('available')
          // Don't call onComplete() - force user to update
        })
        unsubscribers.push(unsubAvailable)
      }

      // Listen for no update available
      if (window.electronAPI?.onUpdateNotAvailable) {
        const unsubNotAvailable = window.electronAPI.onUpdateNotAvailable(() => {
          console.log('No updates available')
          setUpdateStatus('none')
          // Auto-proceed to login if no updates
          setTimeout(() => onComplete(), 500)
        })
        unsubscribers.push(unsubNotAvailable)
      }

      // Listen for update errors
      if (window.electronAPI?.onUpdateError) {
        const unsubError = window.electronAPI.onUpdateError((errorMessage: string) => {
          console.error('Update error:', errorMessage)
          setError(errorMessage)
          setUpdateStatus('error')
        })
        unsubscribers.push(unsubError)
      }

      // Listen for download progress
      if (window.electronAPI?.onDownloadProgress) {
        const unsubProgress = window.electronAPI.onDownloadProgress((progressObj: any) => {
          setDownloadProgress(Math.round(progressObj.percent))
        })
        unsubscribers.push(unsubProgress)
      }

      // Listen for update downloaded
      if (window.electronAPI?.onUpdateDownloaded) {
        const unsubDownloaded = window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
          // Don't log the entire object to avoid console clutter
          if (info?.version) {
            console.log(`Update downloaded: v${info.version}`)
          }
          setUpdateStatus('downloaded')
        })
        unsubscribers.push(unsubDownloaded)
      }

      // Listen for update check complete (fallback)
      if (window.electronAPI?.onUpdateCheckComplete) {
        const unsubComplete = window.electronAPI.onUpdateCheckComplete(() => {
          if (updateStatus === 'checking') {
            // If still checking, assume no updates and proceed
            setUpdateStatus('none')
            onComplete()
          }
        })
        unsubscribers.push(unsubComplete)
      }
      
      // Trigger the update check after setting up listeners
      try {
        if (window.electronAPI?.checkForUpdates) {
          await window.electronAPI.checkForUpdates()
        } else {
          console.warn('Update check not available')
          // If updates not available, proceed to login
          setTimeout(() => {
            setUpdateStatus('none')
            onComplete()
          }, 1000)
        }
      } catch (error) {
        // Silently handle the error - updates often work despite initial check failing
        // This is usually just a serialization issue with the IPC response
        // Wait a bit to see if update events come through anyway
        setTimeout(() => {
          // Only proceed if we haven't received any update events
          if (updateStatus === 'checking') {
            setUpdateStatus('none')
            onComplete()
          }
        }, 2000)
      }
    }

    setupListeners()

    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub && unsub())
    }
  }, [onComplete])

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    try {
      const result = await window.electronAPI?.invoke('download-update')
      if (!result?.success) {
        setError(result?.error || 'Failed to download update')
        setUpdateStatus('error')
      }
    } catch (err) {
      console.error('Error downloading update:', err)
      setError('Failed to download update')
      setUpdateStatus('error')
    }
  }

  const handleInstallUpdate = () => {
    window.electronAPI?.invoke('install-update')
  }

  // Don't show anything if no updates available
  if (updateStatus === 'none') {
    return null
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
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {updateStatus === 'checking' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <div className="spinner" style={{ marginRight: '12px' }} />
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>Checking for Updates</h2>
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
              Please wait while we check for the latest version of RadPal...
            </p>
            
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .spinner {
                width: 24px;
                height: 24px;
                border: 3px solid rgba(255, 255, 255, 0.1);
                border-top: 3px solid #3B82F6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
              }
            `}</style>
          </>
        )}
        
        {updateStatus === 'available' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <AlertCircle size={24} color="#FFA500" style={{ marginRight: '12px' }} />
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>Update Available</h2>
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
              A new version of RadPal ({updateInfo?.version}) is available.
            </p>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', marginBottom: '24px' }}>
              <strong>This update is required to continue.</strong> Please download and install the latest version to use RadPal.
            </p>

            {updateInfo?.releaseNotes && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                <div 
                  style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', margin: 0 }}
                  dangerouslySetInnerHTML={{ 
                    __html: updateInfo.releaseNotes
                      // Strip any script tags for security
                      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                      // Convert paragraphs to have proper spacing
                      .replace(/<p>/gi, '<p style="margin: 0 0 8px 0;">')
                      // Convert headings to smaller size
                      .replace(/<h([1-6])>/gi, '<h$1 style="font-size: 14px; margin: 8px 0;">') 
                  }}
                />
              </div>
            )}

            <button
              onClick={handleDownloadUpdate}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#3B82F6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Download size={18} />
              Download Required Update
            </button>
          </>
        )}

        {updateStatus === 'downloading' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <Download size={24} color="#3B82F6" style={{ marginRight: '12px' }} />
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>Downloading Update</h2>
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '16px' }}>
              Please wait while the update is being downloaded...
            </p>

            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden',
              marginBottom: '8px'
            }}>
              <div style={{
                backgroundColor: '#3B82F6',
                height: '100%',
                width: `${downloadProgress}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', textAlign: 'center' }}>
              {downloadProgress}% complete
            </p>
          </>
        )}

        {updateStatus === 'downloaded' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <CheckCircle size={24} color="#22C55E" style={{ marginRight: '12px' }} />
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>Update Ready</h2>
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '24px' }}>
              The update has been downloaded and is ready to install. The application will restart to complete the installation.
            </p>

            <button
              onClick={handleInstallUpdate}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#22C55E',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Restart and Install
            </button>
          </>
        )}

        {updateStatus === 'error' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <X size={24} color="#EF4444" style={{ marginRight: '12px' }} />
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '20px' }}>Update Error</h2>
            </div>
            
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
              Failed to download the required update. RadPal cannot continue without the latest version.
            </p>
            
            {error && (
              <p style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: '12px', marginBottom: '24px' }}>
                Error: {error}
              </p>
            )}
            
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', marginBottom: '24px' }}>
              Please check your internet connection and try again. If the problem persists, 
              please download the update manually from the RadPal website.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#3B82F6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Retry Update Check
            </button>
          </>
        )}
      </div>
    </div>
  )
}