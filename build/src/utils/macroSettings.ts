/**
 * Macro settings management utilities
 */

import type { MacroSettings } from '../types/macro';
import { DEFAULT_MACRO_SETTINGS } from '../types/macro';

const SETTINGS_KEY = 'radpal_macro_settings';

/**
 * Load macro settings from localStorage
 */
export function loadMacroSettings(): MacroSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_MACRO_SETTINGS,
        ...settings
      };
    }
  } catch (error) {
    console.error('Error loading macro settings:', error);
  }
  
  return DEFAULT_MACRO_SETTINGS;
}

/**
 * Save macro settings to localStorage
 */
export function saveMacroSettings(settings: MacroSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving macro settings:', error);
  }
}

/**
 * Reset macro settings to defaults
 */
export function resetMacroSettings(): MacroSettings {
  saveMacroSettings(DEFAULT_MACRO_SETTINGS);
  return DEFAULT_MACRO_SETTINGS;
}