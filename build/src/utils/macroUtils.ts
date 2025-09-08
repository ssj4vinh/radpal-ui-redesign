/**
 * Macro detection and execution utilities
 */

import { macroStore } from '../stores/macroStore';
import type { Macro, MacroDetectionResult, MacroScope, MacroSettings } from '../types/macro';
import { DEFAULT_MACRO_SETTINGS } from '../types/macro';

/**
 * Detect if text contains a macro command
 */
export function detectMacroCommand(
  text: string,
  settings: MacroSettings = DEFAULT_MACRO_SETTINGS
): MacroDetectionResult {
  if (!settings.enabled) {
    return { isMacro: false };
  }

  const triggerWord = settings.triggerWord || 'macro';
  
  // Build regex patterns for detection
  // Pattern 1: Pure command (e.g., "macro knee")
  const pureCommandPattern = new RegExp(
    `^\\s*${escapeRegex(triggerWord)}\\s+([a-zA-Z0-9_-]+)\\s*$`,
    'i'
  );
  
  // Pattern 2: Command at the end of text (e.g., "The patient has macro knee")
  const endCommandPattern = new RegExp(
    `(.*)\\s+${escapeRegex(triggerWord)}\\s+([a-zA-Z0-9_-]+)\\s*$`,
    'i'
  );

  // Check for fuzzy matches if enabled
  let patterns = [pureCommandPattern, endCommandPattern];
  
  if (settings.fuzzyVoiceMatches) {
    // Add common mis-hears
    const fuzzyTriggers = getFuzzyTriggerWords(triggerWord);
    fuzzyTriggers.forEach(fuzzy => {
      patterns.push(
        new RegExp(`^\\s*${escapeRegex(fuzzy)}\\s+([a-zA-Z0-9_-]+)\\s*$`, 'i'),
        new RegExp(`(.*)\\s+${escapeRegex(fuzzy)}\\s+([a-zA-Z0-9_-]+)\\s*$`, 'i')
      );
    });
  }

  // Test patterns
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[2]) {
        // End command pattern - has text before the macro
        return {
          isMacro: true,
          macroName: match[2],
          remainingText: match[1].trim()
        };
      } else if (match[1]) {
        // Pure command pattern
        return {
          isMacro: true,
          macroName: match[1],
          remainingText: undefined
        };
      }
    }
  }

  return { isMacro: false };
}

/**
 * Get fuzzy variations of the trigger word
 */
function getFuzzyTriggerWords(triggerWord: string): string[] {
  const variations: string[] = [];
  
  if (triggerWord.toLowerCase() === 'macro') {
    // Common STT mis-hears for "macro"
    variations.push('micro', 'mackerel', 'macaroni', 'mccrow', 'macrow', 'makro');
  }
  
  // Could add more variations for other trigger words
  
  return variations;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the current scope based on which editor is focused
 */
export function getCurrentScope(): MacroScope {
  // Check which textarea/editor has focus
  const activeElement = document.activeElement;
  
  if (!activeElement) return 'global';
  
  // Check by ID or data attributes
  const elementId = activeElement.id?.toLowerCase() || '';
  const dataScope = activeElement.getAttribute('data-macro-scope');
  
  if (dataScope) {
    return dataScope as MacroScope;
  }
  
  if (elementId.includes('findings') || activeElement.closest('[data-editor="findings"]')) {
    return 'findings';
  }
  
  if (elementId.includes('impression') || activeElement.closest('[data-editor="impression"]')) {
    return 'impression';
  }
  
  return 'global';
}

/**
 * Execute a macro by name
 */
export async function executeMacro(
  macroName: string,
  scopeHint?: MacroScope
): Promise<{ success: boolean; macro?: Macro; error?: string }> {
  try {
    const scope = scopeHint || getCurrentScope();
    const macro = await macroStore.getMacroByName(macroName, scope);
    
    if (!macro) {
      return {
        success: false,
        error: `Macro "${macroName}" not found`
      };
    }
    
    return {
      success: true,
      macro
    };
  } catch (error) {
    console.error('Error executing macro:', error);
    return {
      success: false,
      error: 'Failed to execute macro'
    };
  }
}

/**
 * Insert text at the current caret position with smart spacing
 */
export function insertMacroText(
  element: HTMLTextAreaElement | HTMLElement,
  text: string
): void {
  if (element instanceof HTMLTextAreaElement) {
    insertInTextarea(element, text);
  } else if (element.isContentEditable) {
    insertInContentEditable(element, text);
  }
}

/**
 * Insert text in textarea element
 */
function insertInTextarea(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  
  // Get text before and after selection
  const before = value.substring(0, start);
  const after = value.substring(end);
  
  // Apply smart spacing
  let insertText = text;
  
  // Check if we need a space before
  if (before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')) {
    const lastChar = before[before.length - 1];
    const firstChar = text[0];
    
    if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z]/.test(firstChar)) {
      insertText = ' ' + insertText;
    } else if (/[.,:;!?]/.test(lastChar) && /[a-zA-Z]/.test(firstChar)) {
      insertText = ' ' + insertText;
    }
  }
  
  // Check if we need a space after
  if (after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n')) {
    const lastChar = insertText[insertText.length - 1];
    const firstChar = after[0];
    
    if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z]/.test(firstChar)) {
      insertText = insertText + ' ';
    }
  }
  
  // Insert the text
  textarea.value = before + insertText + after;
  
  // Set cursor position after inserted text
  const newPos = start + insertText.length;
  textarea.setSelectionRange(newPos, newPos);
  
  // Trigger input event
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
}

/**
 * Insert text in contenteditable element
 */
function insertInContentEditable(element: HTMLElement, text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  
  // Delete selected content if any
  if (!range.collapsed) {
    range.deleteContents();
  }
  
  // Get context for smart spacing
  const container = range.startContainer;
  let insertText = text;
  
  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container as Text;
    const offset = range.startOffset;
    const nodeText = textNode.textContent || '';
    
    // Check if we need space before
    if (offset > 0) {
      const charBefore = nodeText[offset - 1];
      const firstChar = text[0];
      
      if (/[a-zA-Z0-9]/.test(charBefore) && /[a-zA-Z]/.test(firstChar)) {
        insertText = ' ' + insertText;
      } else if (/[.,:;!?]/.test(charBefore) && /[a-zA-Z]/.test(firstChar)) {
        insertText = ' ' + insertText;
      }
    }
    
    // Check if we need space after
    if (offset < nodeText.length) {
      const charAfter = nodeText[offset];
      const lastChar = insertText[insertText.length - 1];
      
      if (/[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z]/.test(charAfter)) {
        insertText = insertText + ' ';
      }
    }
  }
  
  // Insert the text
  const textNode = document.createTextNode(insertText);
  range.insertNode(textNode);
  
  // Move cursor after inserted text
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Trigger input event
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Get caret position for showing picklist dropdown
 */
export function getCaretPosition(element: HTMLElement): { x: number; y: number } | null {
  if (element instanceof HTMLTextAreaElement) {
    // For textarea, we need to create a mirror element to measure position
    return getTextareaCaretPosition(element);
  } else if (element.isContentEditable) {
    // For contenteditable, use Selection API
    return getContentEditableCaretPosition();
  }
  
  return null;
}

/**
 * Get caret position in textarea
 */
function getTextareaCaretPosition(textarea: HTMLTextAreaElement): { x: number; y: number } {
  // Create a mirror div to calculate position
  const mirror = document.createElement('div');
  const computed = window.getComputedStyle(textarea);
  
  // Copy styles
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'hidden';
  
  // Copy relevant styles
  ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
   'textTransform', 'wordSpacing', 'textIndent', 'padding', 'border',
   'boxSizing', 'lineHeight'].forEach(prop => {
    mirror.style[prop] = computed[prop];
  });
  
  mirror.style.width = textarea.offsetWidth + 'px';
  
  // Add text up to cursor
  const text = textarea.value.substring(0, textarea.selectionStart);
  mirror.textContent = text;
  
  // Add a span for cursor position
  const span = document.createElement('span');
  span.textContent = '|';
  mirror.appendChild(span);
  
  document.body.appendChild(mirror);
  
  const rect = textarea.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  
  document.body.removeChild(mirror);
  
  return {
    x: rect.left + (spanRect.left - mirror.getBoundingClientRect().left),
    y: rect.top + (spanRect.top - mirror.getBoundingClientRect().top)
  };
}

/**
 * Get caret position in contenteditable element
 */
function getContentEditableCaretPosition(): { x: number; y: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  return {
    x: rect.left,
    y: rect.top
  };
}

/**
 * Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}