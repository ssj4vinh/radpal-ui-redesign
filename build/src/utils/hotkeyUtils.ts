// Utility functions for handling keyboard shortcuts

export interface HotkeyConfig {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

// Parse a hotkey string like "Ctrl+Alt+F5" into a config object
export function parseHotkey(hotkeyString: string): HotkeyConfig {
  const parts = hotkeyString.split('+').map(part => part.trim())
  
  const config: HotkeyConfig = {
    key: '',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false
  }
  
  parts.forEach(part => {
    const lowerPart = part.toLowerCase()
    if (lowerPart === 'ctrl' || lowerPart === 'control') {
      config.ctrl = true
    } else if (lowerPart === 'alt') {
      config.alt = true
    } else if (lowerPart === 'shift') {
      config.shift = true
    } else if (lowerPart === 'meta' || lowerPart === 'cmd' || lowerPart === 'command') {
      config.meta = true
    } else {
      // This is the main key
      config.key = part
    }
  })
  
  return config
}

// Convert a HotkeyConfig back to a string representation
export function hotkeyToString(config: HotkeyConfig): string {
  const parts: string[] = []
  
  if (config.ctrl) parts.push('Ctrl')
  if (config.alt) parts.push('Alt')
  if (config.shift) parts.push('Shift')
  if (config.meta) parts.push('Meta')
  if (config.key) parts.push(config.key)
  
  return parts.join('+')
}

// Check if a keyboard event matches a hotkey config
export function matchesHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  return (
    event.key === config.key &&
    event.ctrlKey === config.ctrl &&
    event.altKey === config.alt &&
    event.shiftKey === config.shift &&
    event.metaKey === config.meta
  )
}

// Default hotkey configurations
export const DEFAULT_DICTATION_HOTKEY = 'F5'

// Get current dictation hotkey from localStorage
export function getDictationHotkey(): string {
  return localStorage.getItem('dictation_hotkey') || DEFAULT_DICTATION_HOTKEY
}

// Save dictation hotkey to localStorage
export function setDictationHotkey(hotkey: string): void {
  localStorage.setItem('dictation_hotkey', hotkey)
}