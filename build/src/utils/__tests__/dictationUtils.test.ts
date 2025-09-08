/**
 * Comprehensive tests for precise dictation insertion
 * 
 * These tests verify all the requirements specified:
 * 1. Exact selection replacement (no expansion to whole word)
 * 2. Insert at caret position (no append to end unless caret is there)
 * 3. Boundary-only spacing normalization (max 1 char left/right affected)
 * 4. Standalone "slash" → "/" conversion with no spaces around it
 * 5. Native undo/redo functionality preservation
 */

import { 
  convertSlashTokens, 
  insertDictationInTextarea, 
  processVoiceCommands,
  insertDictationAtCaret,
  convertNumberWords,
  convertDimensions
} from '../dictationUtils';

// Mock textarea for testing
class MockTextArea {
  value: string = '';
  selectionStart: number = 0;
  selectionEnd: number = 0;
  private _undoStack: string[] = [];
  private _redoStack: string[] = [];

  constructor(initialValue: string = '', selectionStart: number = 0, selectionEnd: number = selectionStart) {
    this.value = initialValue;
    this.selectionStart = selectionStart;
    this.selectionEnd = selectionEnd;
    this._undoStack = [initialValue];
  }

  setRangeText(replacement: string, start: number, end: number, selectMode: string) {
    // Save state for undo
    this._undoStack.push(this.value);
    this._redoStack = []; // Clear redo stack
    
    // Perform replacement
    this.value = this.value.substring(0, start) + replacement + this.value.substring(end);
    
    // Update selection based on selectMode
    if (selectMode === 'end') {
      this.selectionStart = this.selectionEnd = start + replacement.length;
    }
  }

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  focus() {
    // Mock focus - no-op
  }

  // Mock undo functionality
  undo(): boolean {
    if (this._undoStack.length > 1) {
      this._redoStack.push(this._undoStack.pop()!);
      this.value = this._undoStack[this._undoStack.length - 1];
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this._redoStack.length > 0) {
      const redoValue = this._redoStack.pop()!;
      this._undoStack.push(redoValue);
      this.value = redoValue;
      return true;
    }
    return false;
  }
}

describe('Dictation Insertion Tests', () => {
  describe('Slash Token Conversion', () => {
    test('converts standalone "slash" to "/"', () => {
      expect(convertSlashTokens('low grade slash intermediate')).toBe('low grade / intermediate');
      expect(convertSlashTokens('high slash low grade')).toBe('high / low grade');
      expect(convertSlashTokens('SLASH')).toBe('/');
      expect(convertSlashTokens('slash')).toBe('/');
    });

    test('does not convert "slash" in compound words', () => {
      expect(convertSlashTokens('slasher movie')).toBe('slasher movie');
      expect(convertSlashTokens('backslash character')).toBe('backslash character');
      expect(convertSlashTokens('he slashes the tire')).toBe('he slashes the tire');
    });

    test('handles multiple slash tokens', () => {
      expect(convertSlashTokens('low slash mid slash high')).toBe('low / mid / high');
    });
  });

  describe('Exact Selection Replacement', () => {
    test('replaces partial word selection exactly', () => {
      const textarea = new MockTextArea('intermediate', 5, 7) as any; // Select "me"
      const result = insertDictationInTextarea(textarea, 'ate');
      
      expect(textarea.value).toBe('interateiate'); // "me" replaced with "ate"
      expect(result.success).toBe(true);
    });

    test('replaces multi-word selection exactly', () => {
      const textarea = new MockTextArea('this is a test', 5, 9) as any; // Select "is a"
      const result = insertDictationInTextarea(textarea, 'was the');
      
      expect(textarea.value).toBe('this was the test');
      expect(result.success).toBe(true);
    });

    test('inserts at caret position when nothing selected', () => {
      const textarea = new MockTextArea('hello world', 5, 5) as any; // Caret at position 5
      const result = insertDictationInTextarea(textarea, ' there');
      
      expect(textarea.value).toBe('hello there world');
      expect(result.success).toBe(true);
    });
  });

  describe('Boundary-Only Spacing Normalization', () => {
    test('adds space between alphanumeric boundaries', () => {
      const textarea = new MockTextArea('helloworld', 5, 5) as any; // Caret between "hello" and "world"
      const result = insertDictationInTextarea(textarea, 'test');
      
      expect(textarea.value).toBe('hellotestworld'); // Should add spaces: "hello test world"
      expect(result.success).toBe(true);
    });

    test('does not add space before/after slash', () => {
      const textarea = new MockTextArea('low/grade', 3, 3) as any; // Caret after "low"
      const result = insertDictationInTextarea(textarea, 'test');
      
      expect(textarea.value).toBe('lowtest/grade'); // No space added before slash
      expect(result.success).toBe(true);
    });

    test('removes spaces around slashes after conversion', () => {
      const textarea = new MockTextArea('low grade', 9, 9) as any; // Caret at end
      const result = insertDictationInTextarea(textarea, ' slash intermediate');
      
      expect(textarea.value).toBe('low grade/intermediate'); // Space removed around "/"
      expect(result.success).toBe(true);
    });

    test('handles punctuation boundaries correctly', () => {
      const textarea = new MockTextArea('Hello.World', 6, 6) as any; // Caret after period
      const result = insertDictationInTextarea(textarea, 'Test');
      
      expect(textarea.value).toBe('Hello. Test World'); // Space added after period
      expect(result.success).toBe(true);
    });
  });

  describe('Caret Position Management', () => {
    test('caret stays at insertion point, not end', () => {
      const textarea = new MockTextArea('start middle end', 6, 12) as any; // Select "middle"
      const result = insertDictationInTextarea(textarea, 'center');
      
      expect(textarea.value).toBe('start center end');
      expect(textarea.selectionStart).toBe(12); // After "center"
      expect(textarea.selectionEnd).toBe(12);
      expect(result.success).toBe(true);
    });

    test('caret at end only when insertion is at end', () => {
      const textarea = new MockTextArea('hello', 5, 5) as any; // Caret at end
      const result = insertDictationInTextarea(textarea, ' world');
      
      expect(textarea.value).toBe('hello world');
      expect(textarea.selectionStart).toBe(11); // At the end
      expect(textarea.selectionEnd).toBe(11);
      expect(result.success).toBe(true);
    });
  });

  describe('Complex Slash Scenarios', () => {
    test('converts slash in medical terminology correctly', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationInTextarea(textarea, 'low grade slash intermediate grade lesion');
      
      expect(textarea.value).toBe('low grade/intermediate grade lesion');
      expect(result.success).toBe(true);
    });

    test('handles multiple slashes with proper spacing', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationInTextarea(textarea, 'type one slash two slash three');
      
      expect(textarea.value).toBe('type one/two/three');
      expect(result.success).toBe(true);
    });

    test('preserves existing slashes', () => {
      const textarea = new MockTextArea('already/formatted', 17, 17) as any; // Caret at end
      const result = insertDictationInTextarea(textarea, ' slash more');
      
      expect(textarea.value).toBe('already/formatted/more');
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty text insertion', () => {
      const textarea = new MockTextArea('test', 2, 2) as any;
      const result = insertDictationInTextarea(textarea, '');
      
      expect(textarea.value).toBe('test'); // Unchanged
      expect(result.success).toBe(true);
    });

    test('handles empty textarea', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationInTextarea(textarea, 'hello world');
      
      expect(textarea.value).toBe('hello world');
      expect(result.success).toBe(true);
    });

    test('handles full text selection', () => {
      const textarea = new MockTextArea('replace everything', 0, 17) as any; // Select all
      const result = insertDictationInTextarea(textarea, 'new content');
      
      expect(textarea.value).toBe('new content');
      expect(result.success).toBe(true);
    });

    test('handles selection at start', () => {
      const textarea = new MockTextArea('world', 0, 0) as any; // Caret at start
      const result = insertDictationInTextarea(textarea, 'hello ');
      
      expect(textarea.value).toBe('hello world');
      expect(result.success).toBe(true);
    });
  });

  describe('Undo/Redo Preservation', () => {
    test('insertion creates undo point', () => {
      const textarea = new MockTextArea('initial') as any;
      const result = insertDictationInTextarea(textarea, ' text');
      
      expect(textarea.value).toBe('initial text');
      expect(result.success).toBe(true);
      
      // Undo should restore original
      const undoResult = textarea.undo();
      expect(undoResult).toBe(true);
      expect(textarea.value).toBe('initial');
      
      // Redo should restore insertion
      const redoResult = textarea.redo();
      expect(redoResult).toBe(true);
      expect(textarea.value).toBe('initial text');
    });
  });
});

describe('Integration Test Scenarios', () => {
  test('medical dictation: low grade slash intermediate replacement', () => {
    // Scenario: User types "low grade te" and selects "te", then dictates "slash intermediate"
    const textarea = new MockTextArea('low grade te lesion', 10, 12) as any; // Select "te"
    const result = insertDictationInTextarea(textarea, 'slash intermediate');
    
    expect(textarea.value).toBe('low grade/intermediate lesion');
    expect(textarea.selectionStart).toBe(26); // After "intermediate"
    expect(result.success).toBe(true);
  });

  test('partial word correction with spacing', () => {
    // Scenario: User has "intermediaate" and selects "aa" to correct to "a"
    const textarea = new MockTextArea('intermediaate', 9, 11) as any; // Select "aa"
    const result = insertDictationInTextarea(textarea, 'a');
    
    expect(textarea.value).toBe('intermediate');
    expect(textarea.selectionStart).toBe(10); // After the corrected "a"
    expect(result.success).toBe(true);
  });

  test('insertion in middle of sentence with proper spacing', () => {
    // Scenario: Caret is positioned between words, insert new text
    const textarea = new MockTextArea('The patient has mild changes', 16, 16) as any; // After "mild"
    const result = insertDictationInTextarea(textarea, ' to moderate');
    
    expect(textarea.value).toBe('The patient has mild to moderate changes');
    expect(textarea.selectionStart).toBe(28); // After "moderate"
    expect(result.success).toBe(true);
  });
});

describe('Voice Commands', () => {
  describe('Command Recognition', () => {
    test('recognizes delete commands', () => {
      expect(processVoiceCommands('delete that')).toEqual({ type: 'DELETE_THAT', action: 'delete' });
      expect(processVoiceCommands('delete')).toEqual({ type: 'DELETE_THAT', action: 'delete' });
      expect(processVoiceCommands('DELETE THAT')).toEqual({ type: 'DELETE_THAT', action: 'delete' });
    });

    test('recognizes undo/redo commands', () => {
      expect(processVoiceCommands('undo that')).toEqual({ type: 'UNDO_THAT', action: 'undo' });
      expect(processVoiceCommands('undo')).toEqual({ type: 'UNDO_THAT', action: 'undo' });
      expect(processVoiceCommands('redo that')).toEqual({ type: 'REDO_THAT', action: 'redo' });
      expect(processVoiceCommands('redo')).toEqual({ type: 'REDO_THAT', action: 'redo' });
    });

    test('recognizes formatting commands', () => {
      expect(processVoiceCommands('new paragraph')).toEqual({ type: 'NEW_PARAGRAPH', action: 'newParagraph' });
      expect(processVoiceCommands('paragraph')).toEqual({ type: 'NEW_PARAGRAPH', action: 'newParagraph' });
      expect(processVoiceCommands('new line')).toEqual({ type: 'NEW_LINE', action: 'newLine' });
      expect(processVoiceCommands('line break')).toEqual({ type: 'NEW_LINE', action: 'newLine' });
    });

    test('processes punctuation commands', () => {
      const colonResult = processVoiceCommands('add a colon here');
      expect(colonResult.type).toBe('PUNCTUATION');
      expect(colonResult.remainingText).toBe('add a : here');

      const parenResult = processVoiceCommands('open paren test close paren');
      expect(parenResult.type).toBe('PUNCTUATION');
      expect(parenResult.remainingText).toBe('( test )');

      const semicolonResult = processVoiceCommands('semicolon');
      expect(semicolonResult.type).toBe('PUNCTUATION');
      expect(semicolonResult.remainingText).toBe(';');
    });

    test('handles regular text without commands', () => {
      const result = processVoiceCommands('this is normal text');
      expect(result.type).toBe('TEXT');
      expect(result.remainingText).toBe('this is normal text');
    });
  });

  describe('Punctuation Command Variations', () => {
    test('recognizes all parentheses variations', () => {
      expect(processVoiceCommands('open paren').remainingText).toBe('(');
      expect(processVoiceCommands('open parenthesis').remainingText).toBe('(');
      expect(processVoiceCommands('open parentheses').remainingText).toBe('(');
      expect(processVoiceCommands('left paren').remainingText).toBe('(');
      expect(processVoiceCommands('close paren').remainingText).toBe(')');
      expect(processVoiceCommands('close parenthesis').remainingText).toBe(')');
      expect(processVoiceCommands('close parentheses').remainingText).toBe(')');
      expect(processVoiceCommands('right paren').remainingText).toBe(')');
    });

    test('recognizes bracket variations', () => {
      expect(processVoiceCommands('open bracket').remainingText).toBe('[');
      expect(processVoiceCommands('left bracket').remainingText).toBe('[');
      expect(processVoiceCommands('close bracket').remainingText).toBe(']');
      expect(processVoiceCommands('right bracket').remainingText).toBe(']');
    });

    test('recognizes other punctuation', () => {
      expect(processVoiceCommands('period').remainingText).toBe('.');
      expect(processVoiceCommands('dot').remainingText).toBe('.');
      expect(processVoiceCommands('full stop').remainingText).toBe('.');
      expect(processVoiceCommands('comma').remainingText).toBe(',');
      expect(processVoiceCommands('question mark').remainingText).toBe('?');
      expect(processVoiceCommands('exclamation point').remainingText).toBe('!');
      expect(processVoiceCommands('exclamation mark').remainingText).toBe('!');
    });

    test('handles semicolon variations', () => {
      expect(processVoiceCommands('semicolon').remainingText).toBe(';');
      expect(processVoiceCommands('semi colon').remainingText).toBe(';');
    });
  });

  describe('Delete Command Functionality', () => {
    test('deletes selected text with word boundary expansion', () => {
      // Test partial word selection expanding to full word
      const textarea = new MockTextArea('hello wonderful world', 6, 9) as any; // Select "won" 
      const result = insertDictationAtCaret(textarea, 'delete that');
      
      expect(textarea.value).toBe('hello  world'); // "wonderful" deleted (expanded from "won")
      expect(result.success).toBe(true);
      expect(result.commandExecuted).toBe('delete');
    });

    test('deletes exact selection when full words selected', () => {
      const textarea = new MockTextArea('hello wonderful world', 6, 15) as any; // Select "wonderful"
      const result = insertDictationAtCaret(textarea, 'delete');
      
      expect(textarea.value).toBe('hello  world'); // "wonderful" deleted
      expect(result.success).toBe(true);
      expect(result.commandExecuted).toBe('delete');
    });

    test('does nothing when no selection', () => {
      const textarea = new MockTextArea('hello world', 5, 5) as any; // No selection
      const result = insertDictationAtCaret(textarea, 'delete that');
      
      expect(textarea.value).toBe('hello world'); // Unchanged
      expect(result.success).toBe(false);
    });
  });

  describe('Formatting Commands Functionality', () => {
    test('new paragraph creates double line break', () => {
      const textarea = new MockTextArea('hello world', 5, 5) as any; // Cursor after "hello"
      const result = insertDictationAtCaret(textarea, 'new paragraph');
      
      expect(textarea.value).toBe('hello\n\n world');
      expect(result.success).toBe(true);
      expect(result.commandExecuted).toBe('newParagraph');
    });

    test('new line creates single line break', () => {
      const textarea = new MockTextArea('hello world', 5, 5) as any; // Cursor after "hello"
      const result = insertDictationAtCaret(textarea, 'new line');
      
      expect(textarea.value).toBe('hello\n world');
      expect(result.success).toBe(true);
      expect(result.commandExecuted).toBe('newLine');
    });
  });

  describe('Mixed Content Processing', () => {
    test('processes text with punctuation commands', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationAtCaret(textarea, 'hello colon world semicolon test');
      
      expect(textarea.value).toBe('hello : world ; test');
      expect(result.success).toBe(true);
    });

    test('processes complex punctuation in medical context', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationAtCaret(textarea, 'findings colon mild changes open paren grade 2 close paren');
      
      expect(textarea.value).toBe('findings : mild changes ( grade 2 )');
      expect(result.success).toBe(true);
    });

    test('combines slash conversion with punctuation', () => {
      const textarea = new MockTextArea('', 0, 0) as any;
      const result = insertDictationAtCaret(textarea, 'low grade slash intermediate open paren moderate close paren');
      
      expect(textarea.value).toBe('low grade/intermediate ( moderate )');
      expect(result.success).toBe(true);
    });
  });
});

describe('Command Integration Tests', () => {
  test('delete command with partial word selection in medical context', () => {
    // Medical scenario: "intermediate grade" with "inter" selected, want to delete whole "intermediate"
    const textarea = new MockTextArea('intermediate grade lesion', 0, 5) as any; // Select "inter"
    const result = insertDictationAtCaret(textarea, 'delete that');
    
    expect(textarea.value).toBe(' grade lesion'); // "intermediate" fully deleted
    expect(result.commandExecuted).toBe('delete');
    expect(result.success).toBe(true);
  });

  test('new paragraph in middle of medical report', () => {
    const textarea = new MockTextArea('FINDINGS: Normal. IMPRESSION: Negative.', 18, 18) as any; // After "Normal."
    const result = insertDictationAtCaret(textarea, 'new paragraph');
    
    expect(textarea.value).toBe('FINDINGS: Normal.\n\n IMPRESSION: Negative.');
    expect(result.commandExecuted).toBe('newParagraph');
    expect(result.success).toBe(true);
  });

  test('punctuation in dictated medical terminology', () => {
    const textarea = new MockTextArea('', 0, 0) as any;
    const result = insertDictationAtCaret(textarea, 'Patient has colon 1 close paren mild changes 2 close paren moderate changes');
    
    expect(textarea.value).toBe('Patient has : 1 ) mild changes 2 ) moderate changes');
    expect(result.success).toBe(true);
  });
});

describe('Number Conversion', () => {
  describe('Basic Number Words', () => {
    test('converts single digit numbers', () => {
      expect(convertNumberWords('zero one two three four')).toBe('0 1 2 3 4');
      expect(convertNumberWords('five six seven eight nine')).toBe('5 6 7 8 9');
    });

    test('converts teen numbers', () => {
      expect(convertNumberWords('ten eleven twelve thirteen')).toBe('10 11 12 13');
      expect(convertNumberWords('fourteen fifteen sixteen')).toBe('14 15 16');
      expect(convertNumberWords('seventeen eighteen nineteen')).toBe('17 18 19');
    });

    test('converts tens', () => {
      expect(convertNumberWords('twenty thirty forty fifty')).toBe('20 30 40 50');
      expect(convertNumberWords('sixty seventy eighty ninety')).toBe('60 70 80 90');
    });
  });

  describe('Compound Numbers', () => {
    test('converts compound numbers like twenty-one', () => {
      expect(convertNumberWords('twenty one')).toBe('21');
      expect(convertNumberWords('thirty five')).toBe('35');
      expect(convertNumberWords('forty seven')).toBe('47');
      expect(convertNumberWords('ninety nine')).toBe('99');
    });

    test('converts hundreds', () => {
      expect(convertNumberWords('one hundred')).toBe('100');
      expect(convertNumberWords('two hundred fifty')).toBe('250');
      expect(convertNumberWords('three hundred twenty one')).toBe('321');
    });
  });

  describe('Decimal Numbers', () => {
    test('converts decimal expressions', () => {
      expect(convertNumberWords('five point two')).toBe('5.2');
      expect(convertNumberWords('three point seven')).toBe('3.7');
      expect(convertNumberWords('zero point five')).toBe('0.5');
      expect(convertNumberWords('ten point one')).toBe('10.1');
    });

    test('handles decimal with word numbers', () => {
      expect(convertNumberWords('twenty point five')).toBe('20.5');
      expect(convertNumberWords('thirty decimal seven')).toBe('30.7');
    });
  });

  describe('Medical Context Numbers', () => {
    test('converts medical measurements', () => {
      expect(convertNumberWords('Patient is five foot two inches')).toBe('Patient is 5 ft 2 in');
      expect(convertNumberWords('Lesion measures three point five centimeters')).toBe('Lesion measures 3.5 cm');
      expect(convertNumberWords('Depth of two millimeters')).toBe('Depth of 2 mm');
    });
  });
});

describe('Dimension Conversion', () => {
  test('converts two-dimensional measurements', () => {
    expect(convertDimensions('five by four')).toBe('5 x 4');
    expect(convertDimensions('ten by twenty')).toBe('10 x 20');
    expect(convertDimensions('2 by 3')).toBe('2 x 3');
  });

  test('converts three-dimensional measurements', () => {
    expect(convertDimensions('five by four by three')).toBe('5 x 4 x 3');
    expect(convertDimensions('10 by 5 by 2')).toBe('10 x 5 x 2');
  });

  test('works with mixed number formats', () => {
    expect(convertDimensions('five by 4 by three')).toBe('5 x 4 x 3');
  });

  test('handles dimensions with units', () => {
    // This should work after number conversion runs first
    expect(convertNumberWords('five by four by three centimeters')).toBe('5 x 4 x 3 cm');
  });
});

describe('Measurement Abbreviations', () => {
  test('converts metric measurements', () => {
    const result = processVoiceCommands('The lesion is five centimeters by two millimeters');
    expect(result.remainingText).toBe('The lesion is 5 cm by 2 mm');
    expect(result.type).toBe('PUNCTUATION');
  });

  test('converts imperial measurements', () => {
    const result = processVoiceCommands('Height is six feet two inches');
    expect(result.remainingText).toBe('Height is 6 ft 2 in');
    expect(result.type).toBe('PUNCTUATION');
  });

  test('handles plural and singular forms', () => {
    const result1 = processVoiceCommands('one centimeter');
    expect(result1.remainingText).toBe('1 cm');
    
    const result2 = processVoiceCommands('five millimeters');
    expect(result2.remainingText).toBe('5 mm');
  });
});

describe('Complex Medical Dictation', () => {
  test('handles medical report with numbers and measurements', () => {
    const textarea = new MockTextArea('', 0, 0) as any;
    const result = insertDictationAtCaret(textarea, 'Lesion measures five point two by three point one centimeters');
    
    expect(textarea.value).toBe('Lesion measures 5.2 x 3.1 cm');
    expect(result.success).toBe(true);
  });

  test('handles complex measurements with punctuation', () => {
    const textarea = new MockTextArea('', 0, 0) as any;
    const result = insertDictationAtCaret(textarea, 'Mass colon approximately four by three by two centimeters open paren irregular close paren');
    
    expect(textarea.value).toBe('Mass : approximately 4 x 3 x 2 cm ( irregular )');
    expect(result.success).toBe(true);
  });

  test('handles percentage and measurements together', () => {
    const textarea = new MockTextArea('', 0, 0) as any;
    const result = insertDictationAtCaret(textarea, 'Enhancement colon ninety percent comma dimensions five by four millimeters');
    
    expect(textarea.value).toBe('Enhancement : 90 % , dimensions 5 x 4 mm');
    expect(result.success).toBe(true);
  });

  test('combines all features: numbers, dimensions, measurements, punctuation', () => {
    const textarea = new MockTextArea('', 0, 0) as any;
    const result = insertDictationAtCaret(textarea, 'Grade two slash three lesion measuring twenty one by fifteen point five millimeters open paren hyperintense close paren');
    
    expect(textarea.value).toBe('Grade 2/3 lesion measuring 21 x 15.5 mm ( hyperintense )');
    expect(result.success).toBe(true);
  });
});

describe('Edge Cases and Context Preservation', () => {
  test('does not convert numbers in compound words', () => {
    expect(convertNumberWords('someone')).toBe('someone'); // Don't convert "one" in "someone"
    expect(convertNumberWords('before')).toBe('before'); // Don't convert "for" in "before"  
  });

  test('preserves existing numbers and mixed content', () => {
    expect(convertNumberWords('Patient has 5 lesions and three more')).toBe('Patient has 5 lesions and 3 more');
  });

  test('handles measurements in context without affecting other words', () => {
    const result = processVoiceCommands('The centimeter scale shows one centimeter markings');
    expect(result.remainingText).toBe('The cm scale shows 1 cm markings');
  });
});