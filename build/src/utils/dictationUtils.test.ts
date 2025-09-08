import { normalizeDictation, normalizeSpacingAroundInsertion, insertDictationAtCaret } from './dictationUtils';

describe('Dictation Utilities', () => {
  describe('normalizeDictation', () => {
    it('should convert standalone "slash" to "/"', () => {
      expect(normalizeDictation('low grade slash intermediate')).toBe('low grade/intermediate');
      expect(normalizeDictation('Slash between words')).toBe('/ between words');
      expect(normalizeDictation('word slash another slash more')).toBe('word/another/more');
    });

    it('should not convert "slash" when part of another word', () => {
      expect(normalizeDictation('slasher movie')).toBe('slasher movie');
      expect(normalizeDictation('backslash character')).toBe('backslash character');
      expect(normalizeDictation('slashing prices')).toBe('slashing prices');
    });

    it('should handle case-insensitive replacement', () => {
      expect(normalizeDictation('low SLASH high')).toBe('low/high');
      expect(normalizeDictation('Slash Slash slash')).toBe('///');
    });

    it('should trim whitespace', () => {
      expect(normalizeDictation('  text with spaces  ')).toBe('text with spaces');
      expect(normalizeDictation('\nlow slash high\t')).toBe('low/high');
    });
  });

  describe('normalizeSpacingAroundInsertion', () => {
    it('should add space between word boundaries', () => {
      const result = normalizeSpacingAroundInsertion(
        'HelloWorld',
        'there',
        5,
        10
      );
      expect(result.text).toBe('Hello there World');
    });

    it('should not add space around "/"', () => {
      const result = normalizeSpacingAroundInsertion(
        'low  high',
        '/',
        4,
        4
      );
      expect(result.text).toBe('low/high');
    });

    it('should prevent double spaces', () => {
      const result = normalizeSpacingAroundInsertion(
        'Hello  World',
        'beautiful',
        6,
        6
      );
      expect(result.text).toBe('Hello beautiful World');
    });

    it('should add space after sentence-ending punctuation', () => {
      const result = normalizeSpacingAroundInsertion(
        'First sentence.Second sentence',
        '',
        14,
        14
      );
      expect(result.text).toBe('First sentence. Second sentence');
    });

    it('should handle insertion at start of text', () => {
      const result = normalizeSpacingAroundInsertion(
        'World',
        'Hello',
        0,
        5
      );
      expect(result.text).toBe('Hello World');
    });

    it('should handle insertion at end of text', () => {
      const result = normalizeSpacingAroundInsertion(
        'Hello World',
        'everyone',
        11,
        19
      );
      expect(result.text).toBe('Hello World everyone');
    });

    it('should handle partial word replacement', () => {
      const result = normalizeSpacingAroundInsertion(
        'Heworld',
        'llo ',
        2,
        6
      );
      expect(result.text).toBe('Hello world');
    });
  });

  describe('insertDictationAtCaret', () => {
    let textarea: HTMLTextAreaElement;

    beforeEach(() => {
      // Create a mock textarea element
      textarea = document.createElement('textarea');
      textarea.value = 'Initial text here';
      document.body.appendChild(textarea);
    });

    afterEach(() => {
      document.body.removeChild(textarea);
    });

    it('should replace selected text', () => {
      textarea.value = 'Hello world';
      textarea.setSelectionRange(6, 11); // Select "world"
      
      const result = insertDictationAtCaret(textarea, 'everyone', textarea.value);
      expect(result.newValue).toBe('Hello everyone');
      expect(result.newCaret).toBe(14);
    });

    it('should insert at caret position when nothing selected', () => {
      textarea.value = 'Hello world';
      textarea.setSelectionRange(5, 5); // Caret after "Hello"
      
      const result = insertDictationAtCaret(textarea, 'beautiful', textarea.value);
      expect(result.newValue).toBe('Hello beautiful world');
      expect(result.newCaret).toBe(15);
    });

    it('should handle "slash" token conversion', () => {
      textarea.value = 'low grade  intermediate';
      textarea.setSelectionRange(10, 10); // Caret in the middle
      
      const result = insertDictationAtCaret(textarea, 'slash', textarea.value);
      expect(result.newValue).toBe('low grade/intermediate');
    });

    it('should insert at start when caret at position 0', () => {
      textarea.value = 'world';
      textarea.setSelectionRange(0, 0);
      
      const result = insertDictationAtCaret(textarea, 'Hello', textarea.value);
      expect(result.newValue).toBe('Hello world');
      expect(result.newCaret).toBe(5);
    });

    it('should insert at end when caret at end', () => {
      textarea.value = 'Hello';
      textarea.setSelectionRange(5, 5);
      
      const result = insertDictationAtCaret(textarea, 'world', textarea.value);
      expect(result.newValue).toBe('Hello world');
      expect(result.newCaret).toBe(11);
    });

    it('should handle multiple sequential insertions without double spaces', () => {
      textarea.value = 'The patient has';
      textarea.setSelectionRange(15, 15);
      
      let result = insertDictationAtCaret(textarea, 'low grade', textarea.value);
      textarea.value = result.newValue;
      textarea.setSelectionRange(result.newCaret, result.newCaret);
      
      result = insertDictationAtCaret(textarea, 'slash', textarea.value);
      textarea.value = result.newValue;
      textarea.setSelectionRange(result.newCaret, result.newCaret);
      
      result = insertDictationAtCaret(textarea, 'intermediate', textarea.value);
      
      expect(result.newValue).toBe('The patient has low grade/intermediate');
      expect(result.newValue.indexOf('  ')).toBe(-1); // No double spaces
    });

    it('should handle partial word replacement correctly', () => {
      textarea.value = 'The pati is here';
      textarea.setSelectionRange(7, 8); // Select just "i" in "pati"
      
      const result = insertDictationAtCaret(textarea, 'ient', textarea.value);
      expect(result.newValue).toBe('The patient is here');
    });

    it('should not move caret to end when inserting in middle', () => {
      textarea.value = 'Start End';
      textarea.setSelectionRange(5, 5); // Caret after "Start"
      
      const result = insertDictationAtCaret(textarea, 'Middle', textarea.value);
      expect(result.newValue).toBe('Start Middle End');
      expect(result.newCaret).toBe(12); // After "Middle", not at end
      expect(result.newCaret).not.toBe(result.newValue.length);
    });
  });

  describe('Undo/Redo behavior', () => {
    it('should maintain undo history when using setRangeText', () => {
      const textarea = document.createElement('textarea');
      textarea.value = 'Initial text';
      document.body.appendChild(textarea);
      
      // Simulate insertion using setRangeText
      textarea.setSelectionRange(7, 7);
      textarea.setRangeText(' new', 7, 7, 'end');
      
      expect(textarea.value).toBe('Initial new text');
      
      // Note: Actual undo/redo testing would require browser environment
      // or more sophisticated mocking as document.execCommand isn't available in JSDOM
      
      document.body.removeChild(textarea);
    });
  });
});