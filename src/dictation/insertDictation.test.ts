import { normalizeTranscript, applySmartSpacing, expandToWordBoundaries } from './normalization';

describe('Dictation Normalization', () => {
  describe('normalizeTranscript', () => {
    it('converts number words to digits', () => {
      expect(normalizeTranscript('five')).toBe('5');
      expect(normalizeTranscript('twenty one')).toBe('21');
      expect(normalizeTranscript('five point four')).toBe('5.4');
    });

    it('replaces punctuation words', () => {
      expect(normalizeTranscript('period')).toBe('.');
      expect(normalizeTranscript('comma')).toBe(',');
      expect(normalizeTranscript('question mark')).toBe('?');
    });

    it('handles special commands', () => {
      expect(normalizeTranscript('new line')).toBe('\n');
      expect(normalizeTranscript('paragraph')).toBe('\n\n');
    });

    it('applies custom replacements', () => {
      const custom: Array<[string, string]> = [['ACL', 'anterior cruciate ligament']];
      expect(normalizeTranscript('ACL', custom)).toBe('anterior cruciate ligament');
    });
  });

  describe('expandToWordBoundaries', () => {
    it('expands partial word selection', () => {
      const text = 'The quick brown fox';
      // Selecting "ui" in "quick"
      const result = expandToWordBoundaries(text, 5, 7);
      expect(result).toEqual({ start: 4, end: 9 }); // "quick"
    });

    it('expands selection spanning multiple words', () => {
      const text = 'The quick brown fox';
      // Selecting from "ick" to "bro"
      const result = expandToWordBoundaries(text, 6, 13);
      expect(result).toEqual({ start: 4, end: 15 }); // "quick brown"
    });

    it('does not expand cursor position (no selection)', () => {
      const text = 'The quick brown fox';
      const result = expandToWordBoundaries(text, 5, 5);
      expect(result).toEqual({ start: 5, end: 5 });
    });
  });

  describe('applySmartSpacing', () => {
    it('adds space between words', () => {
      const result = applySmartSpacing('hello', 'world', 'there');
      expect(result.textToInsert).toBe(' world ');
    });

    it('no space before punctuation', () => {
      const result = applySmartSpacing('hello ', '.', ' there');
      expect(result.leftTrim).toBe(1); // Trim the space before period
      expect(result.textToInsert).toBe('.');
    });

    it('capitalizes at beginning', () => {
      const result = applySmartSpacing('', 'hello', 'world');
      expect(result.textToInsert).toBe('Hello ');
    });

    it('capitalizes after sentence end', () => {
      const result = applySmartSpacing('Hello.', 'world', 'there');
      expect(result.textToInsert).toBe(' World ');
    });

    it('handles slashes without spaces', () => {
      const result = applySmartSpacing('low ', '/', ' intermediate');
      expect(result.leftTrim).toBe(1);
      expect(result.rightTrim).toBe(1);
      expect(result.textToInsert).toBe('/');
    });

    it('handles parentheses correctly', () => {
      const left = applySmartSpacing('test', '(', 'content');
      expect(left.textToInsert).toBe(' (');
      
      const right = applySmartSpacing('content', ')', 'test');
      expect(right.textToInsert).toBe(') ');
    });

    it('handles newlines by trimming spaces', () => {
      const result = applySmartSpacing('hello  ', '\n', '  world');
      expect(result.leftTrim).toBe(2);
      expect(result.rightTrim).toBe(2);
      expect(result.textToInsert).toBe('\n');
    });
  });
});