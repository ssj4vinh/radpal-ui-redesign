import React, { useState, useEffect } from 'react';
import { getDictationHotkey, setDictationHotkey, DEFAULT_DICTATION_HOTKEY } from '../utils/hotkeyUtils';

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

const ShortcutManager = ({ visible, onClose }) => {
  const defaultShortcuts = [
    { hotkey: 'F5', action: 'dictation', enabled: true, text: '' },
    { hotkey: 'Ctrl+Alt+1', action: 'autofill-1', enabled: true, text: '' },
    { hotkey: 'Ctrl+Alt+2', action: 'autofill-2', enabled: true, text: '' }
  ];

  const [shortcuts, setShortcuts] = useState(defaultShortcuts);

  useEffect(() => {
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
  localStorage.setItem('globalShortcuts', JSON.stringify(shortcuts));

  // Save dictation hotkey separately
  const dictationShortcut = shortcuts.find(s => s.action === 'dictation');
  if (dictationShortcut) {
    setDictationHotkey(dictationShortcut.hotkey);
  }

  const payload = shortcuts.map((entry) => ({
    hotkey: entry.hotkey,
    action: entry.action,
    text: entry.text,
    enabled: entry.enabled
  }));

  window.electron?.ipcRenderer?.invoke('compile-autofill-hotkeys', payload);
  onClose();
};



  if (!visible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 style={{ fontFamily: "'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif", fontWeight: 400 }}>Keyboard Shortcut Settings</h2>





        {shortcuts.map((entry, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 30,
              opacity: entry.enabled ? 1 : 0.4
            }}
          >
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(e) => {
                const updated = [...shortcuts];
                updated[idx].enabled = e.target.checked;
                setShortcuts(updated);
              }}
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
  {entry.action === 'autofill-1' && 'Auto Text Fill 1'}
  {entry.action === 'autofill-2' && 'Auto Text Fill 2'}


  {entry.action.startsWith('autofill') && (
    <input
      type="password"
      value={entry.text || ''}
      onChange={(e) => {
        const updated = [...shortcuts];
        updated[idx].text = e.target.value;
        setShortcuts(updated);
      }}
      placeholder="Paste text"
      style={{
        width: 180,
        marginTop: 4,
        padding: '4px 8px',
        borderRadius: 4,
        border: 'none',
        backgroundColor: '#2c2c2c',
        color: '#fff',
        fontSize: 14,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 400
      }}
    />
  )}
</div>

          </div>
        ))}

        <div style={{ textAlign: 'right', marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
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
  );
};

export default ShortcutManager;
