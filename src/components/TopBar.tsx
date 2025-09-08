import React, { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export default function TopBar({
  isContracted,
  onGenerate,
  onGenerateImpression,
  onOpenShortcutManager,
  apiProvider,
  onApiProviderChange,
  isOfflineMode
}: {
  isContracted: boolean
  onGenerate: () => void
  onGenerateImpression: () => void
  onOpenShortcutManager: () => void
  apiProvider: 'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi'
  onApiProviderChange: (provider: 'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi') => void
  isOfflineMode: boolean
}) {
  const [showSettings, setShowSettings] = useState(false)
  
  // ✅ contract, -, and + buttons

  const handleContract = () => {
  window.electron?.ipcRenderer?.send('contract-window');
  }

  const handleMinimize = () => {
    window.electron?.ipcRenderer?.send('minimize-popup')
  }

  const handleClose = () => {
    window.electron?.ipcRenderer?.send('close-popup')
  }

  const handleExpand = () => {
    window.electron?.ipcRenderer?.send('expand-window')
  }


  const handleSettingsAction = (action: string) => {
  if (action === 'edit') {
    window.electron?.ipcRenderer?.send('open-popup-templates', { isOfflineMode })
  } else if (action === 'edit-logic') {
    window.electron?.ipcRenderer?.send('open-popup-logic', { isOfflineMode })
  } else if (action === 'debug') {
    window.dispatchEvent(new CustomEvent('toggle-debug'))
  } else if (action === 'shortcuts') {
    onOpenShortcutManager() // ✅ this should be its own else-if block
  } else if (action === 'logout') {
    window.electronAPI?.authSignOut().then(() => {
      localStorage.setItem('autoFindings', 'false')
      // Remove the resize-main-ui call that might be causing the problem
      setTimeout(() => {
        window.location.reload()
      }, 100)
    })
  }
}


  return (
    <div
      className="radpal-topbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        WebkitAppRegion: 'drag',
        borderBottom: 'transparent'
      }}
      onClick={isContracted ? handleExpand : undefined}
    >
      {/* LEFT: Settings dropdown - only visible on hover */}
      {!isContracted && (
  <div 
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8, 
      WebkitAppRegion: 'no-drag',
      position: 'relative',
      width: 150,
      height: 40
    }}
    onMouseEnter={() => setShowSettings(true)}
    onMouseLeave={() => setShowSettings(false)}
  >
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          className="radpal-settings-trigger"
          style={{
            opacity: showSettings ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: showSettings ? 'auto' : 'none'
          }}
        >
          ⚙️ Settings
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        key="expanded"
        className="radpal-dropdown"
        side="bottom"
        align="start"
        alignOffset={4}
      >
        <DropdownMenuItem className="radpal-item" onClick={() => handleSettingsAction('edit')}>
          Manage Templates
        </DropdownMenuItem>
        <DropdownMenuItem className="radpal-item" onClick={() => handleSettingsAction('edit-logic')}>
          Edit Logic
        </DropdownMenuItem>
        <DropdownMenuItem className="radpal-item" onClick={() => handleSettingsAction('shortcuts')}>
          Keyboard Shortcuts ⌨️
        </DropdownMenuItem>
        <DropdownMenuItem className="radpal-item" onClick={() => handleSettingsAction('logout')}>
          Log Out ⚡
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)}


      {isContracted && (
  <div style={{ display: 'flex', gap: 6, WebkitAppRegion: 'no-drag', alignItems: 'center' }}>
    {/* AI Model Toggle Buttons - Compact Version */}
    <div style={{ display: 'flex', gap: 2, padding: 2, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('openai');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'openai' ? '#5F33FF' : 'transparent',
          color: apiProvider === 'openai' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        GPT
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('gemini');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'gemini' ? '#5F33FF' : 'transparent',
          color: apiProvider === 'gemini' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        GEM
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('claude-sonnet');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'claude-sonnet' ? '#5F33FF' : 'transparent',
          color: apiProvider === 'claude-sonnet' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        C4S
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('claude-opus');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'claude-opus' ? '#5F33FF' : 'transparent',
          color: apiProvider === 'claude-opus' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        C4O
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('claude-opus-4.1');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'claude-opus-4.1' ? '#7A4FFF' : 'transparent',
          color: apiProvider === 'claude-opus-4.1' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        C4.1O
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onApiProviderChange('kimi');
        }}
        style={{
          padding: '2px 4px',
          backgroundColor: apiProvider === 'kimi' ? '#5F33FF' : 'transparent',
          color: apiProvider === 'kimi' ? '#fff' : '#ccc',
          border: 'none',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 300,
          fontFamily: 'SF Pro, system-ui, sans-serif',
          transition: 'all 0.2s ease'
        }}
      >
        K2
      </button>
    </div>
    
    {/* Report and Impression Buttons */}
    <button
      className="radpal-button-report radpal-button-mini"
      onClick={(e) => {
        e.stopPropagation();
        onGenerate();
      }}
      style={{
        padding: '2px 6px',
        fontSize: 11,
        lineHeight: 1.1,
        color: '#fff',
        fontFamily: 'SF Pro, system-ui, sans-serif',
        fontWeight: 400
      }}
    >
      Report
    </button>
    <button
      className="radpal-button-impression radpal-button-mini"
      onClick={(e) => {
        e.stopPropagation();
        onGenerateImpression();
      }}
      style={{
        padding: '2px 6px',
        fontSize: 11,
        lineHeight: 1.1,
        color: '#fff',
        fontFamily: 'SF Pro, system-ui, sans-serif',
        fontWeight: 400
      }}
    >
      Impression
    </button>
  </div>
)}

{/* RIGHT: Minimize and Close */}
<div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag', marginRight: 40 }}>
  


  
  <button
    onClick={handleContract}
    style={{
      background: '#444',
      border: 'none',
      borderRadius: 4,
      padding: '2px 8px',
      color: '#fff',
      /* cursor removed */
    }}
    title="Contract Window"
  >
    ⤢
  </button>

  <button
    onClick={handleMinimize}
    style={{
      background: 'transparent',
      border: 'none',
      borderRadius: 4,
      padding: '2px 8px',
      color: '#ccc',
      /* cursor removed */
    }}
  >
    –
  </button>

  <button
    onClick={handleClose}
    style={{
      background: '#E36756',
      border: 'none',
      borderRadius: 4,
      padding: '2px 8px',
      color: '#fff',
      /* cursor removed */
    }}
  >
    ×
  </button>
</div>

    </div>
  )
}