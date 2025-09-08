import React, { useState, useEffect } from 'react';

interface WindowShortcutCreatorProps {
  visible: boolean;
  onClose: () => void;
  theme?: string;
}

const WindowShortcutCreator: React.FC<WindowShortcutCreatorProps> = ({ visible, onClose, theme = 'dark' }) => {
  const [windowTitle, setWindowTitle] = useState('');
  const [keyToPress, setKeyToPress] = useState('F4');
  const [hotkeyTrigger, setHotkeyTrigger] = useState('Ctrl+Shift+W');
  const [isRecording, setIsRecording] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [scriptName, setScriptName] = useState('WindowFocus');

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && visible && !isRecording) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose, isRecording]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
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
    setHotkeyTrigger(hotkey);
    setIsRecording(false);
  };

  const convertToAHKFormat = (key: string) => {
    // Convert common key formats to AHK format
    const keyMap: { [key: string]: string } = {
      'Ctrl': '^',
      'Alt': '!',
      'Shift': '+',
      'Meta': '#',
      'Win': '#',
      'Space': 'Space',
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Escape': 'Escape',
      'Esc': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'Insert': 'Insert',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PgUp',
      'PageDown': 'PgDn',
      'ArrowUp': 'Up',
      'ArrowDown': 'Down',
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right'
    };

    // Handle modifier keys
    let ahkKey = key;
    Object.entries(keyMap).forEach(([original, ahk]) => {
      ahkKey = ahkKey.replace(new RegExp(`\\b${original}\\b`, 'g'), ahk);
    });

    // Handle the + separator for modifiers
    ahkKey = ahkKey.replace(/\+(?=[^+])/g, '');
    
    return ahkKey;
  };

  const generateAHKScript = () => {
    const ahkHotkey = convertToAHKFormat(hotkeyTrigger);
    const ahkKey = keyToPress.startsWith('F') ? `{${keyToPress}}` : keyToPress;
    
    return `; RadPal Window Focus Script
; Hotkey: ${hotkeyTrigger}
; Target Window: ${windowTitle}
; Key to Send: ${keyToPress}

#NoEnv
#SingleInstance Force
SendMode Input
SetWorkingDir %A_ScriptDir%
SetTitleMatchMode, RegEx  ; Use RegEx for case-insensitive partial matching
DetectHiddenWindows, Off

${ahkHotkey}::
    ; Save current window
    WinGet, CurrentWindow, ID, A
    
    ; Create case-insensitive regex pattern for partial matching
    ; The "i)" prefix makes it case-insensitive
    SearchPattern := "i).*" . "${windowTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" . ".*"
    
    ; Find and activate target window using case-insensitive partial match
    SetTitleMatchMode, RegEx
    IfWinExist, % SearchPattern
    {
        WinActivate
        WinWaitActive, % SearchPattern, , 2
        if ErrorLevel
        {
            MsgBox, 0, RadPal, Failed to activate window matching "${windowTitle}"
            return
        }
        Sleep, 100  ; Small delay to ensure window is ready
        Send, ${ahkKey}
        
        ; Optional: Return to original window
        ; WinActivate, ahk_id %CurrentWindow%
    }
    else
    {
        MsgBox, 0, RadPal, No window found matching "${windowTitle}" (case-insensitive)
    }
return

; Exit hotkey
^Escape::ExitApp`;
  };

  const handleCompile = async () => {
    if (!windowTitle || !keyToPress || !hotkeyTrigger) {
      alert('Please fill in all fields');
      return;
    }

    setIsCompiling(true);

    try {
      const script = generateAHKScript();
      const payload = {
        script,
        scriptName: scriptName || 'WindowFocus',
        windowTitle,
        keyToPress,
        hotkeyTrigger
      };

      // Send to electron to compile
      const result = await window.electron?.ipcRenderer?.invoke('compile-window-shortcut', payload);
      
      if (result?.success) {
        // Save to localStorage for auto-launch on login
        const existingShortcuts = JSON.parse(localStorage.getItem('radpal_window_shortcuts') || '[]');
        const newShortcut = {
          name: scriptName || 'WindowFocus',
          windowTitle,
          keyToPress,
          hotkey: hotkeyTrigger,
          enabled: true,
          createdAt: new Date().toISOString()
        };
        
        // Check if shortcut with same name exists and update it
        const existingIndex = existingShortcuts.findIndex(s => s.name === newShortcut.name);
        if (existingIndex >= 0) {
          existingShortcuts[existingIndex] = newShortcut;
        } else {
          existingShortcuts.push(newShortcut);
        }
        
        localStorage.setItem('radpal_window_shortcuts', JSON.stringify(existingShortcuts));
        
        alert(`Successfully created ${scriptName}.exe!\n\nThe shortcut "${hotkeyTrigger}" will now focus "${windowTitle}" and press ${keyToPress}\n\nThis shortcut will automatically launch when you log in.`);
        onClose();
      } else {
        alert('Failed to compile the shortcut. Please ensure Ahk2Exe.exe is available.');
      }
    } catch (error) {
      console.error('Error compiling shortcut:', error);
      alert('Error creating shortcut: ' + error.message);
    } finally {
      setIsCompiling(false);
    }
  };

  if (!visible) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: theme === 'light' ? '#ffffff' : '#1e1e1e',
          borderRadius: 12,
          padding: 24,
          width: 500,
          maxWidth: '90%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
          color: theme === 'light' ? '#000000' : '#ffffff',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: theme === 'light' ? '#f0f0f0' : '#333',
            color: theme === 'light' ? '#666' : '#aaa',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 300,
            lineHeight: 1,
            padding: 0,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'light' ? '#e0e0e0' : '#444';
            e.currentTarget.style.color = theme === 'light' ? '#000' : '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'light' ? '#f0f0f0' : '#333';
            e.currentTarget.style.color = theme === 'light' ? '#666' : '#aaa';
          }}
          aria-label="Close"
        >
          ×
        </button>
        
        <h2 style={{ 
          margin: '0 0 20px 0',
          fontSize: 20,
          fontWeight: 500,
          paddingRight: 40 // Add space for the X button
        }}>
          Create Window Focus Shortcut
        </h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 8,
            fontSize: 14,
            opacity: 0.8
          }}>
            Script Name (will create .exe file)
          </label>
          <input
            type="text"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
            placeholder="e.g., FocusPowerScribe"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: theme === 'light' ? '1px solid #ddd' : '1px solid #444',
              backgroundColor: theme === 'light' ? '#f9f9f9' : '#2c2c2c',
              color: theme === 'light' ? '#000' : '#fff',
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 8,
            fontSize: 14,
            opacity: 0.8
          }}>
            Window Title (case-insensitive partial match)
          </label>
          <input
            type="text"
            value={windowTitle}
            onChange={(e) => setWindowTitle(e.target.value)}
            placeholder="e.g., powerscribe, notepad, chrome"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: theme === 'light' ? '1px solid #ddd' : '1px solid #444',
              backgroundColor: theme === 'light' ? '#f9f9f9' : '#2c2c2c',
              color: theme === 'light' ? '#000' : '#fff',
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 8,
            fontSize: 14,
            opacity: 0.8
          }}>
            Key to Press After Focusing
          </label>
          <input
            type="text"
            value={keyToPress}
            onChange={(e) => setKeyToPress(e.target.value)}
            placeholder="e.g., F4, Enter, Tab, Space"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: theme === 'light' ? '1px solid #ddd' : '1px solid #444',
              backgroundColor: theme === 'light' ? '#f9f9f9' : '#2c2c2c',
              color: theme === 'light' ? '#000' : '#fff',
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ 
            display: 'block',
            marginBottom: 8,
            fontSize: 14,
            opacity: 0.8
          }}>
            Hotkey Trigger (click to record)
          </label>
          <input
            type="text"
            value={isRecording ? 'Press keys...' : hotkeyTrigger}
            onClick={() => setIsRecording(true)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsRecording(false)}
            readOnly
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: isRecording 
                ? '2px solid #3ABC96' 
                : (theme === 'light' ? '1px solid #ddd' : '1px solid #444'),
              backgroundColor: theme === 'light' ? '#f9f9f9' : '#2c2c2c',
              color: isRecording ? '#3ABC96' : (theme === 'light' ? '#000' : '#fff'),
              fontSize: 14,
              cursor: 'pointer'
            }}
          />
        </div>

        <div style={{ 
          marginBottom: 20,
          padding: 12,
          borderRadius: 6,
          backgroundColor: theme === 'light' ? '#f0f8ff' : '#1a2332',
          border: '1px solid ' + (theme === 'light' ? '#b0d4ff' : '#2a4a6a'),
          fontSize: 12,
          lineHeight: 1.5
        }}>
          <strong>Preview:</strong><br />
          When you press <code>{hotkeyTrigger}</code>, the script will:<br />
          1. Find any window with title containing "{windowTitle}" (case-insensitive)<br />
          2. Focus that window and send the {keyToPress} key
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: theme === 'light' ? '1px solid #ddd' : '1px solid #444',
              backgroundColor: 'transparent',
              color: theme === 'light' ? '#666' : '#aaa',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCompile}
            disabled={isCompiling || !windowTitle || !keyToPress || !hotkeyTrigger}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: isCompiling || !windowTitle || !keyToPress || !hotkeyTrigger 
                ? '#666' 
                : '#3ABC96',
              color: '#fff',
              cursor: isCompiling || !windowTitle || !keyToPress || !hotkeyTrigger 
                ? 'not-allowed' 
                : 'pointer',
              fontSize: 14
            }}
          >
            {isCompiling ? 'Compiling...' : 'Create Shortcut'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WindowShortcutCreator;