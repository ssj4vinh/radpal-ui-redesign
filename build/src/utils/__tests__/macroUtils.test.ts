/**
 * Unit tests for macro utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectMacroCommand,
  insertMacroText,
  levenshteinDistance
} from '../macroUtils';
import type { MacroSettings } from '../../types/macro';

describe('Macro Detection', () => {
  const defaultSettings: MacroSettings = {
    enabled: true,
    triggerWord: 'macro',
    fuzzyVoiceMatches: false,
    insertLiteralOnNotFound: false
  };

  describe('detectMacroCommand', () => {
    it('should detect pure macro command', () => {
      const result = detectMacroCommand('macro knee', defaultSettings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('knee');
      expect(result.remainingText).toBeUndefined();
    });

    it('should detect macro command with extra spaces', () => {
      const result = detectMacroCommand('  macro   severity  ', defaultSettings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('severity');
    });

    it('should detect macro at end of sentence', () => {
      const result = detectMacroCommand('The patient has macro knee', defaultSettings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('knee');
      expect(result.remainingText).toBe('The patient has');
    });

    it('should handle hyphenated macro names', () => {
      const result = detectMacroCommand('macro left-knee', defaultSettings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('left-knee');
    });

    it('should handle underscore in macro names', () => {
      const result = detectMacroCommand('macro normal_findings', defaultSettings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('normal_findings');
    });

    it('should not detect when disabled', () => {
      const settings = { ...defaultSettings, enabled: false };
      const result = detectMacroCommand('macro knee', settings);
      expect(result.isMacro).toBe(false);
    });

    it('should detect with custom trigger word', () => {
      const settings = { ...defaultSettings, triggerWord: 'template' };
      const result = detectMacroCommand('template knee', settings);
      expect(result.isMacro).toBe(true);
      expect(result.macroName).toBe('knee');
    });

    it('should not detect non-macro text', () => {
      const result = detectMacroCommand('The knee is normal', defaultSettings);
      expect(result.isMacro).toBe(false);
    });

    describe('fuzzy matching', () => {
      const fuzzySettings = { ...defaultSettings, fuzzyVoiceMatches: true };

      it('should detect "micro" as fuzzy match for "macro"', () => {
        const result = detectMacroCommand('micro knee', fuzzySettings);
        expect(result.isMacro).toBe(true);
        expect(result.macroName).toBe('knee');
      });

      it('should detect "mackerel" as fuzzy match', () => {
        const result = detectMacroCommand('mackerel severity', fuzzySettings);
        expect(result.isMacro).toBe(true);
        expect(result.macroName).toBe('severity');
      });

      it('should detect "macaroni" as fuzzy match', () => {
        const result = detectMacroCommand('macaroni normal', fuzzySettings);
        expect(result.isMacro).toBe(true);
        expect(result.macroName).toBe('normal');
      });

      it('should not detect fuzzy matches when disabled', () => {
        const result = detectMacroCommand('micro knee', defaultSettings);
        expect(result.isMacro).toBe(false);
      });
    });
  });
});

describe('Text Insertion', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Create a test textarea
    textarea = document.createElement('textarea');
    textarea.value = '';
    document.body.appendChild(textarea);
  });

  afterEach(() => {
    document.body.removeChild(textarea);
  });

  describe('insertMacroText in textarea', () => {
    it('should insert text at cursor position', () => {
      textarea.value = 'The knee';
      textarea.setSelectionRange(8, 8); // After "knee"
      
      insertMacroText(textarea, 'is normal');
      
      expect(textarea.value).toBe('The knee is normal');
    });

    it('should replace selected text', () => {
      textarea.value = 'The knee is abnormal';
      textarea.setSelectionRange(12, 20); // Select "abnormal"
      
      insertMacroText(textarea, 'normal');
      
      expect(textarea.value).toBe('The knee is normal');
    });

    it('should add space when needed between words', () => {
      textarea.value = 'The knee';
      textarea.setSelectionRange(8, 8); // After "knee"
      
      insertMacroText(textarea, 'appears normal');
      
      expect(textarea.value).toBe('The knee appears normal');
    });

    it('should add space after punctuation', () => {
      textarea.value = 'No fracture.';
      textarea.setSelectionRange(12, 12); // After period
      
      insertMacroText(textarea, 'The joint is normal');
      
      expect(textarea.value).toBe('No fracture. The joint is normal');
    });

    it('should not add double spaces', () => {
      textarea.value = 'The knee ';
      textarea.setSelectionRange(9, 9); // After space
      
      insertMacroText(textarea, 'is normal');
      
      expect(textarea.value).toBe('The knee is normal');
    });

    it('should handle insertion at beginning', () => {
      textarea.value = 'is normal';
      textarea.setSelectionRange(0, 0);
      
      insertMacroText(textarea, 'The knee');
      
      expect(textarea.value).toBe('The knee is normal');
    });

    it('should handle insertion at end', () => {
      textarea.value = 'The knee';
      textarea.setSelectionRange(8, 8);
      
      insertMacroText(textarea, 'is normal.');
      
      expect(textarea.value).toBe('The knee is normal.');
    });

    it('should replace partial word selection', () => {
      textarea.value = 'The knee is abnormal';
      textarea.setSelectionRange(12, 15); // Select "abn" from "abnormal"
      
      insertMacroText(textarea, 'nor');
      
      expect(textarea.value).toBe('The knee is norormal');
    });

    it('should handle empty textarea', () => {
      textarea.value = '';
      textarea.setSelectionRange(0, 0);
      
      insertMacroText(textarea, 'The knee is normal');
      
      expect(textarea.value).toBe('The knee is normal');
    });

    it('should preserve newlines', () => {
      textarea.value = 'First line\n';
      textarea.setSelectionRange(11, 11); // After newline
      
      insertMacroText(textarea, 'Second line');
      
      expect(textarea.value).toBe('First line\nSecond line');
    });

    it('should not add space before newline', () => {
      textarea.value = 'First line';
      textarea.setSelectionRange(10, 10);
      
      insertMacroText(textarea, '\nSecond line');
      
      expect(textarea.value).toBe('First line\nSecond line');
    });
  });
});

describe('Levenshtein Distance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('macro', 'macro')).toBe(0);
  });

  it('should return 1 for single character difference', () => {
    expect(levenshteinDistance('macro', 'micro')).toBe(1);
  });

  it('should handle insertions', () => {
    expect(levenshteinDistance('macro', 'macros')).toBe(1);
  });

  it('should handle deletions', () => {
    expect(levenshteinDistance('macro', 'mcro')).toBe(1);
  });

  it('should handle substitutions', () => {
    expect(levenshteinDistance('macro', 'nacro')).toBe(1);
  });

  it('should handle multiple differences', () => {
    expect(levenshteinDistance('macro', 'microbe')).toBe(3);
  });

  it('should handle empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('macro', '')).toBe(5);
    expect(levenshteinDistance('', 'macro')).toBe(5);
  });

  it('should be case sensitive', () => {
    expect(levenshteinDistance('Macro', 'macro')).toBe(1);
  });
});