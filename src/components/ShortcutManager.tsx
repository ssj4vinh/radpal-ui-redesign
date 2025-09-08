import React, { useState, useEffect } from 'react';
import { getDictationHotkey, setDictationHotkey, DEFAULT_DICTATION_HOTKEY } from '../utils/hotkeyUtils';
import WindowShortcutCreator from './WindowShortcutCreator';

// Hotkey input component for capturing keyboard shortcuts
const HotkeyInput = ({ value, onChange, style }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleKeyDown = (event) => {
    if (!isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    // Ignore modifier keys by themselves
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return;
    }

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    
    // Format the key name
    let keyName = event.key;
    if (keyName === ' ') keyName = 'Space';
    if (keyName.length === 1) keyName = keyName.toUpperCase();
    
    parts.push(keyName);
    
    const hotkey = parts.join('+');
    setDisplayValue(hotkey);
    onChange(hotkey);
    setIsRecording(false);
  };

  const handleClick = () => {
    setIsRecording(true);
    setDisplayValue('Press keys...');
  };

  const handleBlur = () => {
    setIsRecording(false);
    setDisplayValue(value);
  };

  return (
    <input
      type="text"
      value={displayValue}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      readOnly
      placeholder="Click to set hotkey"
      style={{
        ...style,
        padding: '4px 8px',
        borderRadius: 4,
        border: isRecording ? '2px solid #3ABC96' : 'none',
        backgroundColor: isRecording ? '#2c2c2c' : '#2c2c2c',
        color: isRecording ? '#3ABC96' : '#fff',
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 400,
        textAlign: 'center',
        cursor: 'pointer'
      }}
    />
  );
};

const ShortcutManager = ({ visible, onClose, userTier = 1 }) => {
  const defaultShortcuts = [
    { hotkey: 'F5', action: 'dictation', enabled: true, text: '' },
    { hotkey: 'Ctrl+Alt+1', action: 'autofill-1', enabled: true, text: '' },
    { hotkey: 'Ctrl+Alt+2', action: 'autofill-2', enabled: true, text: '' },
    { hotkey: 'Ctrl+Shift+S', action: 'select-first-study', enabled: true, text: '' },
    { hotkey: 'Ctrl+Shift+R', action: 'generate-report', enabled: true, text: '' },
    { hotkey: 'Ctrl+Shift+I', action: 'generate-impression', enabled: true, text: '' }
  ];

  const [shortcuts, setShortcuts] = useState(defaultShortcuts);
  const [showAutoText, setShowAutoText] = useState<{ [key: number]: boolean }>({});
  const [showWindowShortcutCreator, setShowWindowShortcutCreator] = useState(false);
  
  // Dictation import settings
  const [dictationImportConfig, setDictationImportConfig] = useState(() => {
    const saved = localStorage.getItem('dictationImportConfig');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old config to new format with default values
      return {
        ...parsed,
        reportAction: parsed.reportAction || 'generate',
        reportSelectFirstStudy: parsed.reportSelectFirstStudy || false,
        impressionAction: parsed.impressionAction || 'generate',
        impressionSelectFirstStudy: parsed.impressionSelectFirstStudy || false
      };
    }
    return {
      reportEnabled: false,
      reportHotkey: 'Ctrl+Alt+R',
      reportAction: 'generate', // 'paste-only' or 'generate'
      reportSelectFirstStudy: false,
      impressionEnabled: false,
      impressionHotkey: 'Ctrl+Alt+I',
      impressionAction: 'generate', // 'paste-only' or 'generate'
      impressionSelectFirstStudy: false,
      windowTitles: ['PowerScribe', 'Fluency', 'Dragon'],
      customTitle: ''
    };
  });

  useEffect(() => {
    const initializeShortcuts = async () => {
      // Check if this is a fresh install (first time running the app)
      const isProduction = !window.location.hostname.includes('localhost') && 
                          !window.location.hostname.includes('127.0.0.1') &&
                          window.location.protocol === 'file:';
      
      const hasRunBefore = localStorage.getItem('radpal_has_run_before');
      
      // Only clear auto-text on fresh install in production
      if (isProduction && !hasRunBefore) {
        console.log('🔒 Fresh install detected - clearing auto-text values for security');
        // Get stored shortcuts and clear auto-text values
        const stored = JSON.parse(localStorage.getItem('globalShortcuts') || '[]');
        if (stored.length > 0) {
          const clearedShortcuts = stored.map(shortcut => 
            shortcut.action.startsWith('autofill') 
              ? { ...shortcut, text: '' } 
              : shortcut
          );
          // Save back with cleared values
          localStorage.setItem('globalShortcuts', JSON.stringify(clearedShortcuts));
        }
        // Mark that the app has run before
        localStorage.setItem('radpal_has_run_before', 'true');
      } else if (!hasRunBefore) {
        // Mark that the app has run before (even in development)
        localStorage.setItem('radpal_has_run_before', 'true');
      }

      // Load current dictation hotkey and update the default
      const currentDictationHotkey = getDictationHotkey();
      const updatedDefaults = defaultShortcuts.map(shortcut => 
        shortcut.action === 'dictation' 
          ? { ...shortcut, hotkey: currentDictationHotkey }
          : shortcut
      );

      const stored = JSON.parse(localStorage.getItem('globalShortcuts') || '[]');
      const isValid =
        Array.isArray(stored) &&
        stored.length === updatedDefaults.length &&
        stored.every((s, i) => s.action === updatedDefaults[i].action);

      if (isValid) {
        // Update dictation hotkey in stored shortcuts if it changed
        const updatedStored = stored.map(shortcut =>
          shortcut.action === 'dictation'
            ? { ...shortcut, hotkey: currentDictationHotkey }
            : shortcut
        );
        
        setShortcuts(updatedStored);
      } else {
        localStorage.setItem('globalShortcuts', JSON.stringify(updatedDefaults));
        setShortcuts(updatedDefaults);
      }
    };

    initializeShortcuts();
  }, []);


  const compileAndRunAutofillAHK = (shortcuts) => {
  const { writeFileSync } = window.require('fs');
  const path = window.require('path');
  const { spawn } = window.require('child_process');

  const scriptPath = path.join(__dirname, '..', 'RadPalHotkeys.ahk');
  const exePath = path.join(__dirname, '..', 'RadPalHotkeys.exe');
  const ahkCompiler = path.join(__dirname, '..', 'Ahk2Exe.exe');
  const binFile = path.join(__dirname, '..', 'Unicode 64-bit.bin');

  const autofillShortcuts = shortcuts.filter(s => s.enabled && s.action.startsWith('autofill'));

  const script = autofillShortcuts.map(({ hotkey, text }) => {
  const safeText = text.replace(/([{}%,])/g, '{$1}');
  return `
${hotkey}::
  if WinExist("RadPal") {
    WinActivate
    WinWaitActive
    SendInput, ${safeText}
  }
return`;
}).join('\n\n');


  writeFileSync(scriptPath, script);

  spawn(ahkCompiler, [
    '/in', scriptPath,
    '/out', exePath,
    '/bin', binFile
  ]).on('close', () => {
    spawn(exePath, { detached: true, stdio: 'ignore' }).unref();
    console.log('✅ AHK compiled and launched');
  });
};



const handleSave = () => {
  // Filter out disabled autofill shortcuts for non-tier 3 users
  const filteredShortcuts = shortcuts.map((entry) => {
    const isAutofill = entry.action.startsWith('autofill');
    const isDisabledByTier = isAutofill && userTier < 3;
    
    return {
      ...entry,
      enabled: isDisabledByTier ? false : entry.enabled,
      text: isDisabledByTier ? '' : entry.text
    };
  });
  
  localStorage.setItem('globalShortcuts', JSON.stringify(filteredShortcuts));

  // Save dictation hotkey separately
  const dictationShortcut = shortcuts.find(s => s.action === 'dictation');
  if (dictationShortcut) {
    setDictationHotkey(dictationShortcut.hotkey);
  }

  const payload = filteredShortcuts.map((entry) => ({
    hotkey: entry.hotkey,
    action: entry.action,
    text: entry.text,
    enabled: entry.enabled
  }));

  // Save dictation import config
  localStorage.setItem('dictationImportConfig', JSON.stringify(dictationImportConfig));
  
  // Compile dictation import hotkey if tier 3 or higher
  if (userTier >= 3 && window.electronAPI?.compileDictationImportHotkeys) {
    window.electronAPI.compileDictationImportHotkeys(dictationImportConfig)
      .catch(console.error);
  }

  window.electron?.ipcRenderer?.invoke('compile-autofill-hotkeys', payload);
  
  // Save quick action shortcuts to be used by the app
  const quickActions = filteredShortcuts.filter(s => 
    ['select-first-study', 'generate-report', 'generate-impression'].includes(s.action)
  );
  localStorage.setItem('quickActionShortcuts', JSON.stringify(quickActions));
  onClose();
};



  if (!visible) return null;

  return (
    <>
    <div className="modal-overlay">
      <div className="modal-content" style={{ 
        position: 'relative',
        maxHeight: '90vh',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Close X button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#333',
            color: '#aaa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 300,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#444';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
            e.currentTarget.style.color = '#aaa';
          }}
          aria-label="Close"
        >
          ×
        </button>
        
        <h2 style={{ 
          fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif", 
          fontWeight: 500,
          color: '#ffffff',
          marginBottom: 24,
          fontSize: 20,
          paddingRight: 40
        }}>Keyboard Shortcut Settings</h2>
        
        {/* Window Shortcuts Button */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowWindowShortcutCreator(true)}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #6B46C1 0%, #5234a3 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #7d5ace 0%, #5d3cb5 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6B46C1 0%, #5234a3 100%)';
            }}
          >
            <span>⌨️</span>
            Create Window Focus Shortcut
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginBottom: 20,
          paddingRight: 10,
          minHeight: 0
        }}>

        {/* Show/Hide All button for auto-text fields */}
        {userTier >= 3 && shortcuts.some(s => s.action.startsWith('autofill') && s.text) && (
          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => {
                const hasAnyHidden = shortcuts.some((s, idx) => 
                  s.action.startsWith('autofill') && s.text && !showAutoText[idx]
                );
                if (hasAnyHidden) {
                  // Show all
                  const newShowState = {};
                  shortcuts.forEach((s, idx) => {
                    if (s.action.startsWith('autofill') && s.text) {
                      newShowState[idx] = true;
                    }
                  });
                  setShowAutoText(newShowState);
                } else {
                  // Hide all
                  setShowAutoText({});
                }
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 6,
                color: '#aaa',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              {shortcuts.some((s, idx) => s.action.startsWith('autofill') && s.text && !showAutoText[idx]) 
                ? '👁️ Show All Auto-Text' 
                : '👁️‍🗨️ Hide All Auto-Text'}
            </button>
          </div>
        )}

        {shortcuts.map((entry, idx) => {
        // Only show autofill and dictation shortcuts in this section
        if (!['dictation', 'autofill-1', 'autofill-2'].includes(entry.action)) {
          return null;
        }
          const isAutofill = entry.action.startsWith('autofill');
          const isDisabledByTier = isAutofill && userTier < 3;
          
          return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 30,
              opacity: isDisabledByTier ? 0.3 : (entry.enabled ? 1 : 0.6),
              transition: 'opacity 0.2s ease'
            }}
          >
            <input
              type="checkbox"
              checked={isDisabledByTier ? false : entry.enabled}
              onChange={(e) => {
                if (!isDisabledByTier) {
                  const updated = [...shortcuts];
                  updated[idx].enabled = e.target.checked;
                  setShortcuts(updated);
                }
              }}
              disabled={isDisabledByTier}
            />

            {entry.action === 'dictation' ? (
              <HotkeyInput
                value={entry.hotkey}
                onChange={(newHotkey) => {
                  const updated = [...shortcuts];
                  updated[idx].hotkey = newHotkey;
                  setShortcuts(updated);
                }}
                style={{ width: 120 }}
              />
            ) : (
              <div style={{ width: 120 }}>{entry.hotkey}</div>
            )}

            <div style={{ width: 200, fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
  {entry.action === 'dictation' && 'Dictation Toggle'}
  {entry.action === 'autofill-1' && (
    <span>
      Auto Text Fill 1 {isDisabledByTier && '🔒'}
    </span>
  )}
  {entry.action === 'autofill-2' && (
    <span>
      Auto Text Fill 2 {isDisabledByTier && '🔒'}
    </span>
  )}


  {entry.action.startsWith('autofill') && (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type={showAutoText[idx] ? "text" : "password"}
          value={isDisabledByTier ? '' : (entry.text || '')}
          onChange={(e) => {
            if (!isDisabledByTier) {
              const updated = [...shortcuts];
              updated[idx].text = e.target.value;
              setShortcuts(updated);
            }
          }}
          placeholder={isDisabledByTier ? "Premium only" : "Paste text"}
          disabled={isDisabledByTier}
          style={{
            width: 180,
            marginTop: 4,
            padding: '4px 8px',
            borderRadius: 4,
            border: 'none',
            backgroundColor: isDisabledByTier ? '#1a1a1a' : '#2c2c2c',
            color: isDisabledByTier ? '#666' : '#fff',
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 400,
            cursor: isDisabledByTier ? 'not-allowed' : 'text'
          }}
        />
        {!isDisabledByTier && entry.text && (
          <button
            type="button"
            onClick={() => setShowAutoText(prev => ({ ...prev, [idx]: !prev[idx] }))}
            style={{
              marginTop: 4,
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 4,
              color: '#aaa',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            title={showAutoText[idx] ? "Hide text" : "Show text"}
          >
            {showAutoText[idx] ? '👁️' : '👁️‍🗨️'}
          </button>
        )}
      </div>
      {!isDisabledByTier && (
        <div style={{
          marginTop: 4,
          fontSize: 10,
          color: '#ff9800',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          ⚠️ Cleared on app restart for security
        </div>
      )}
    </div>
  )}
</div>

          </div>
        );
        })}
        
        {/* Quick Actions Section */}
        <div style={{
          marginTop: 30,
          paddingTop: 20,
          borderTop: '1px solid #3a3a3a'
        }}>
          <h3 style={{
            color: '#ffffff',
            marginBottom: 16,
            fontSize: 16,
            fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>Quick Actions</h3>
          
          {shortcuts.filter(s => ['select-first-study', 'generate-report', 'generate-impression'].includes(s.action)).map((entry, idx) => {
            const actualIdx = shortcuts.findIndex(s => s === entry);
            const actionLabels = {
              'select-first-study': 'Select First Study Type Suggestion',
              'generate-report': 'Generate Report',
              'generate-impression': 'Generate Impression'
            };
            
            return (
              <div key={entry.action} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
                opacity: entry.enabled ? 1 : 0.4
              }}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) => {
                    const newShortcuts = [...shortcuts];
                    newShortcuts[actualIdx].enabled = e.target.checked;
                    setShortcuts(newShortcuts);
                  }}
                />
                
                <HotkeyInput
                  value={entry.hotkey}
                  onChange={(newHotkey) => {
                    const newShortcuts = [...shortcuts];
                    newShortcuts[actualIdx].hotkey = newHotkey;
                    setShortcuts(newShortcuts);
                  }}
                  style={{ width: 120 }}
                />
                
                <div style={{
                  width: 250,
                  fontSize: 14,
                  color: '#ffffff'
                }}>
                  {actionLabels[entry.action]}
                </div>
              </div>
            );
          })}
          
          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: '#888',
            fontStyle: 'italic'
          }}>
            Note: These shortcuts work when RadPal is focused
          </div>
        </div>
        
        {/* Dictation Import Section - Tier 3 and Above */}
        {userTier >= 3 && (
          <div style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: '1px solid #3a3a3a'
          }}>
            <h3 style={{
              color: '#ffffff',
              marginBottom: 20,
              fontSize: 18
            }}>Dictation Import (Premium Feature)</h3>
            
            <div style={{ marginBottom: 20 }}>
              {/* Report Import */}
              <div style={{
                marginBottom: 20,
                opacity: dictationImportConfig.reportEnabled ? 1 : 0.6
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12
                }}>
                  <input
                    type="checkbox"
                    checked={dictationImportConfig.reportEnabled}
                    onChange={(e) => setDictationImportConfig({
                      ...dictationImportConfig,
                      reportEnabled: e.target.checked
                    })}
                  />
                  
                  <HotkeyInput
                    value={dictationImportConfig.reportHotkey}
                    onChange={(newHotkey) => setDictationImportConfig({
                      ...dictationImportConfig,
                      reportHotkey: newHotkey
                    })}
                    style={{ width: 120 }}
                  />
                  
                  <span style={{ color: '#ffffff', fontSize: 14 }}>
                    Import & Generate Report
                  </span>
                </div>
                
                {/* Report Action Options */}
                {dictationImportConfig.reportEnabled && (
                  <div style={{ marginLeft: 32, marginBottom: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ marginRight: 16 }}>
                        <input
                          type="radio"
                          checked={dictationImportConfig.reportAction === 'paste-only'}
                          onChange={() => setDictationImportConfig({
                            ...dictationImportConfig,
                            reportAction: 'paste-only'
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Paste only (no generation)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={dictationImportConfig.reportAction === 'generate'}
                          onChange={() => setDictationImportConfig({
                            ...dictationImportConfig,
                            reportAction: 'generate'
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Paste & generate report</span>
                      </label>
                    </div>
                    
                    {dictationImportConfig.reportAction === 'generate' && (
                      <label style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={dictationImportConfig.reportSelectFirstStudy}
                          onChange={(e) => setDictationImportConfig({
                            ...dictationImportConfig,
                            reportSelectFirstStudy: e.target.checked
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Auto-select first study type</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
              
              {/* Impression Import */}
              <div style={{
                marginBottom: 20,
                opacity: dictationImportConfig.impressionEnabled ? 1 : 0.6
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12
                }}>
                  <input
                    type="checkbox"
                    checked={dictationImportConfig.impressionEnabled}
                    onChange={(e) => setDictationImportConfig({
                      ...dictationImportConfig,
                      impressionEnabled: e.target.checked
                    })}
                  />
                  
                  <HotkeyInput
                    value={dictationImportConfig.impressionHotkey}
                    onChange={(newHotkey) => setDictationImportConfig({
                      ...dictationImportConfig,
                      impressionHotkey: newHotkey
                    })}
                    style={{ width: 120 }}
                  />
                  
                  <span style={{ color: '#ffffff', fontSize: 14 }}>
                    Import & Generate Impression
                  </span>
                </div>
                
                {/* Impression Action Options */}
                {dictationImportConfig.impressionEnabled && (
                  <div style={{ marginLeft: 32, marginBottom: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ marginRight: 16 }}>
                        <input
                          type="radio"
                          checked={dictationImportConfig.impressionAction === 'paste-only'}
                          onChange={() => setDictationImportConfig({
                            ...dictationImportConfig,
                            impressionAction: 'paste-only'
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Paste only (no generation)</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={dictationImportConfig.impressionAction === 'generate'}
                          onChange={() => setDictationImportConfig({
                            ...dictationImportConfig,
                            impressionAction: 'generate'
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Paste & generate impression</span>
                      </label>
                    </div>
                    
                    {dictationImportConfig.impressionAction === 'generate' && (
                      <label style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={dictationImportConfig.impressionSelectFirstStudy}
                          onChange={(e) => setDictationImportConfig({
                            ...dictationImportConfig,
                            impressionSelectFirstStudy: e.target.checked
                          })}
                          style={{ marginRight: 6 }}
                        />
                        <span style={{ color: '#aaa', fontSize: 13 }}>Auto-select first study type</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
              
              {/* Window configuration - shown if either is enabled */}
              {(dictationImportConfig.reportEnabled || dictationImportConfig.impressionEnabled) && (
                <>
                  <div style={{
                    marginLeft: 32,
                    marginBottom: 12
                  }}>
                    <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 8 }}>
                      Window Titles (comma-separated, partial match):
                    </label>
                    <input
                      type="text"
                      value={dictationImportConfig.windowTitles.join(', ')}
                      onChange={(e) => setDictationImportConfig({
                        ...dictationImportConfig,
                        windowTitles: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                      })}
                      placeholder="PowerScribe, Fluency, Dragon"
                      style={{
                        width: 300,
                        padding: '6px 10px',
                        borderRadius: 4,
                        border: 'none',
                        backgroundColor: '#2c2c2c',
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                  </div>
                  
                  <div style={{
                    marginLeft: 32,
                    marginBottom: 12
                  }}>
                    <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 8 }}>
                      Custom Window Title (optional):
                    </label>
                    <input
                      type="text"
                      value={dictationImportConfig.customTitle}
                      onChange={(e) => setDictationImportConfig({
                        ...dictationImportConfig,
                        customTitle: e.target.value
                      })}
                      placeholder="e.g., My Custom Dictation App"
                      style={{
                        width: 300,
                        padding: '6px 10px',
                        borderRadius: 4,
                        border: 'none',
                        backgroundColor: '#2c2c2c',
                        color: '#fff',
                        fontSize: 13
                      }}
                    />
                  </div>
                </>
              )}
              
              <div style={{
                marginTop: 12,
                fontSize: 11,
                color: '#888',
                fontStyle: 'italic'
              }}>
                How it works: Switch to dictation app → Select all → Copy → Return to RadPal → Clear findings → Paste → Generate
              </div>
            </div>
          </div>
        )}
        
        </div> {/* End of Scrollable Content Container */}

        {/* Fixed Bottom Buttons */}
        <div style={{ 
          textAlign: 'right', 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'flex-end',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: 16,
          flexShrink: 0
        }}>
  <button 
    onClick={onClose}
    style={{
      padding: '8px 16px',
      backgroundColor: '#6c757d',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      /* cursor removed */
      fontSize: '14px',
      fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: 400
    }}
  >
    Cancel
  </button>
  <button 
    onClick={handleSave}
    style={{
      padding: '8px 16px',
      backgroundColor: '#3ABC96',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      /* cursor removed */
      fontSize: '14px',
      fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: 400
    }}
  >
    Save
  </button>
</div>

      </div>
    </div>
    
    {/* Window Shortcut Creator Modal */}
    <WindowShortcutCreator
      visible={showWindowShortcutCreator}
      onClose={() => setShowWindowShortcutCreator(false)}
      theme="dark"
    />
    </>
  );
};

export default ShortcutManager;
