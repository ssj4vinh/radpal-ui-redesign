/**
 * Precise dictation insertion utilities for RadPal
 * 
 * CORE PRINCIPLES:
 * 1. Exact selection replacement - never expand beyond selected range
 * 2. Insert at caret position - never append to end unless caret is there
 * 3. Boundary-only normalization - only 1 char left/right affected
 * 4. Standalone "slash" → "/" with no spaces around it
 * 5. Preserve native undo/redo functionality
 * 6. Voice commands for deletion, undo/redo, formatting
 */

/**
 * Voice command patterns and their replacements
 */
const VOICE_COMMANDS = {
  // Deletion commands - expanded with common mistranscriptions
  // Include variations like "dolita", "delete a", etc.
  DELETE_THAT: /\b(?:delete\s*(?:that|this|it|those|these|all|a|at|the|dad|bad)?|clear\s*(?:that|this|it|all|the|at|a)?|remove\s*(?:that|this|it|all|the|a)?|erase\s*(?:that|this|it|all)?|dolita|dalita|dilita|delita)\b/gi,
  
  // Undo/Redo commands
  UNDO_THAT: /\b(?:undo that|undo)\b/gi,
  REDO_THAT: /\b(?:redo that|redo)\b/gi,
  
  // Formatting commands
  NEW_PARAGRAPH: /\b(?:new paragraph|paragraph)\b/gi,
  NEW_LINE: /\b(?:new line|line break)\b/gi,
  
  // Punctuation commands
  COLON: /\b(?:colon)\b/gi,
  SEMICOLON: /\b(?:semicolon|semi colon)\b/gi,
  OPEN_PAREN: /\b(?:open paren(?:th|thesis|theses)?|left paren(?:th|thesis|theses)?|opening paren(?:th|thesis|theses)?)\b/gi,
  CLOSE_PAREN: /\b(?:close paren(?:th|thesis|theses)?|closed paren(?:th|thesis|theses)?|closing paren(?:th|thesis|theses)?|right paren(?:th|thesis|theses)?)\b/gi,
  OPEN_BRACKET: /\b(?:open bracket|left bracket)\b/gi,
  CLOSE_BRACKET: /\b(?:close bracket|right bracket)\b/gi,
  PERIOD: /\b(?:period|dot|full stop)\b/gi,
  COMMA: /\b(?:comma)\b/gi,
  QUESTION_MARK: /\b(?:question mark)\b/gi,
  EXCLAMATION: /\b(?:exclamation point|exclamation mark)\b/gi,
  
  // Number words to digits - basic numbers
  ZERO: /\b(?:zero)\b/gi,
  ONE: /\b(?:one)\b/gi,
  TWO: /\b(?:two)\b/gi,
  THREE: /\b(?:three)\b/gi,
  FOUR: /\b(?:four)\b/gi,
  FIVE: /\b(?:five)\b/gi,
  SIX: /\b(?:six)\b/gi,
  SEVEN: /\b(?:seven)\b/gi,
  EIGHT: /\b(?:eight)\b/gi,
  NINE: /\b(?:nine)\b/gi,
  TEN: /\b(?:ten)\b/gi,
  ELEVEN: /\b(?:eleven)\b/gi,
  TWELVE: /\b(?:twelve)\b/gi,
  THIRTEEN: /\b(?:thirteen)\b/gi,
  FOURTEEN: /\b(?:fourteen)\b/gi,
  FIFTEEN: /\b(?:fifteen)\b/gi,
  SIXTEEN: /\b(?:sixteen)\b/gi,
  SEVENTEEN: /\b(?:seventeen)\b/gi,
  EIGHTEEN: /\b(?:eighteen)\b/gi,
  NINETEEN: /\b(?:nineteen)\b/gi,
  TWENTY: /\b(?:twenty)\b/gi,
  THIRTY: /\b(?:thirty)\b/gi,
  FORTY: /\b(?:forty)\b/gi,
  FIFTY: /\b(?:fifty)\b/gi,
  SIXTY: /\b(?:sixty)\b/gi,
  SEVENTY: /\b(?:seventy)\b/gi,
  EIGHTY: /\b(?:eighty)\b/gi,
  NINETY: /\b(?:ninety)\b/gi,
  HUNDRED: /\b(?:hundred)\b/gi,
  THOUSAND: /\b(?:thousand)\b/gi,
  
  // Decimal point
  POINT: /\b(?:point|decimal)\b/gi,
  
  // Measurement abbreviations
  CENTIMETERS: /\b(?:centimeters|centimeter|cm)\b/gi,
  MILLIMETERS: /\b(?:millimeters|millimeter|mm)\b/gi,
  METERS: /\b(?:meters|meter|m)\b/gi,
  INCHES: /\b(?:inches|inch|in)\b/gi,
  FEET: /\b(?:feet|foot|ft)\b/gi,
  
  // Dimension separator
  BY: /\b(?:by)\b/gi,
};

/**
 * Voice command types for processing
 */
type VoiceCommandType = 
  | 'DELETE_THAT'
  | 'UNDO_THAT' 
  | 'REDO_THAT'
  | 'NEW_PARAGRAPH'
  | 'NEW_LINE'
  | 'PUNCTUATION'
  | 'TEXT';

/**
 * Result of processing voice commands
 */
interface VoiceCommandResult {
  type: VoiceCommandType;
  action?: string;
  remainingText?: string;
  punctuation?: string;
}

/**
 * Check if a character is alphanumeric
 */
function isAlphanumeric(char: string): boolean {
  return /[a-zA-Z0-9]/.test(char);
}

/**
 * Check if a character is punctuation
 */
function isPunctuation(char: string): boolean {
  return /[.,;:!?]/.test(char);
}

/**
 * Check if a character is a sentence-ending punctuation
 */
function isSentenceEndingPunctuation(char: string): boolean {
  return /[.!?]/.test(char);
}

/**
 * Check if a character is alphabetic
 */
function isAlphabetic(char: string): boolean {
  return /[a-zA-Z]/.test(char);
}

/**
 * Apply proper capitalization after sentence-ending punctuation
 */
function applyCapitalization(text: string, insertStart: number, insertEnd: number): string {
  // Disabled - capitalization is now handled by the backend processor
  // to avoid conflicts and double-capitalization
  return text;
}

/**
 * Process voice commands in dictated text
 */
export function processVoiceCommands(text: string): VoiceCommandResult {
  let trimmedText = text.trim();
  
  // Pre-process common mistranscriptions of "delete that" 
  // Convert variations to normalized form
  const deleteVariations = [
    /^\s*dolita\s*$/i,
    /^\s*dalita\s*$/i, 
    /^\s*dilita\s*$/i,
    /^\s*delita\s*$/i,
    /^\s*delete\s+a\s*$/i,
    /^\s*delete\s+at\s*$/i,
    /^\s*delete\s+the\s*$/i,
    /^\s*delete\s+dad\s*$/i,
    /^\s*delete\s+bad\s*$/i,
    /^\s*clear\s+the\s*$/i,
    /^\s*clear\s+at\s*$/i,
    /^\s*clear\s+a\s*$/i,
    /^\s*remove\s+the\s*$/i,
    /^\s*remove\s+a\s*$/i
  ];
  
  // Check if this is a mistranscription of "delete that"
  for (const pattern of deleteVariations) {
    if (pattern.test(trimmedText)) {
      return { type: 'DELETE_THAT', action: 'delete' };
    }
  }
  
  // Check for deletion commands with the full pattern
  if (VOICE_COMMANDS.DELETE_THAT.test(trimmedText)) {
    return { type: 'DELETE_THAT', action: 'delete' };
  }
  
  // Check for undo/redo commands
  if (VOICE_COMMANDS.UNDO_THAT.test(trimmedText)) {
    return { type: 'UNDO_THAT', action: 'undo' };
  }
  
  if (VOICE_COMMANDS.REDO_THAT.test(trimmedText)) {
    return { type: 'REDO_THAT', action: 'redo' };
  }
  
  // Check for formatting commands
  if (VOICE_COMMANDS.NEW_PARAGRAPH.test(trimmedText)) {
    return { type: 'NEW_PARAGRAPH', action: 'newParagraph' };
  }
  
  if (VOICE_COMMANDS.NEW_LINE.test(trimmedText)) {
    return { type: 'NEW_LINE', action: 'newLine' };
  }
  
  // Process text conversions and return remaining text
  let processedText = text;
  let hasConversions = false;
  
  // Convert numbers first (before punctuation to avoid conflicts)
  const numberConverted = convertNumberWords(processedText);
  if (numberConverted !== processedText) {
    processedText = numberConverted;
    hasConversions = true;
  }
  
  // Replace punctuation commands - spacing will be handled by backend
  processedText = processedText
    .replace(VOICE_COMMANDS.PERIOD, '.')
    .replace(VOICE_COMMANDS.COMMA, ',');
  
  // Replace other punctuation commands
  processedText = processedText
    .replace(VOICE_COMMANDS.COLON, ':')
    .replace(VOICE_COMMANDS.SEMICOLON, ';')
    .replace(VOICE_COMMANDS.OPEN_PAREN, '(')
    .replace(VOICE_COMMANDS.CLOSE_PAREN, ')')
    .replace(VOICE_COMMANDS.OPEN_BRACKET, '[')
    .replace(VOICE_COMMANDS.CLOSE_BRACKET, ']')
    .replace(VOICE_COMMANDS.QUESTION_MARK, '?')
    .replace(VOICE_COMMANDS.EXCLAMATION, '!');
  
  // Replace measurement abbreviations  
  processedText = processedText
    .replace(VOICE_COMMANDS.CENTIMETERS, 'cm')
    .replace(VOICE_COMMANDS.MILLIMETERS, 'mm')
    .replace(VOICE_COMMANDS.METERS, 'm')
    .replace(VOICE_COMMANDS.INCHES, 'in')
    .replace(VOICE_COMMANDS.FEET, 'ft');
  
  // Check if any conversions were made
  hasConversions = hasConversions || processedText !== text;
  
  // Don't apply capitalization here - let the backend handle it
  // to avoid double-capitalization and conflicts
  
  return {
    type: hasConversions ? 'PUNCTUATION' : 'TEXT',
    remainingText: processedText
  };
}

/**
 * Expand selection to word boundaries for deletion
 */
function expandSelectionToWordBoundaries(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  let newStart = start;
  let newEnd = end;
  
  // Expand start to beginning of word
  while (newStart > 0 && isAlphanumeric(text[newStart - 1])) {
    newStart--;
  }
  
  // Expand end to end of word
  while (newEnd < text.length && isAlphanumeric(text[newEnd])) {
    newEnd++;
  }
  
  return { start: newStart, end: newEnd };
}

/**
 * Execute delete command on textarea
 */
function executeDeleteCommand(textarea: HTMLTextAreaElement): boolean {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  
  if (selectionStart === selectionEnd) {
    // No selection - delete the word before cursor (like backspace word)
    if (selectionStart > 0) {
      // Find the start of the previous word
      let wordStart = selectionStart - 1;
      while (wordStart > 0 && /\s/.test(textarea.value[wordStart])) {
        wordStart--;
      }
      while (wordStart > 0 && /\S/.test(textarea.value[wordStart - 1])) {
        wordStart--;
      }
      
      // Delete from word start to cursor
      textarea.setRangeText('', wordStart, selectionStart, 'start');
      return true;
    }
    return false;
  }
  
  // There is a selection - just delete it directly
  // No need to expand to word boundaries when user explicitly selected text
  textarea.setRangeText('', selectionStart, selectionEnd, 'start');
  
  // Trigger input event for React
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
  
  return true;
}

/**
 * Execute undo command on textarea
 */
function executeUndoCommand(element: HTMLTextAreaElement | HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
    try {
      // Focus the element first
      element.focus();
      
      // Execute the undo command
      // This works in most browsers for textarea and contenteditable
      const success = document.execCommand('undo');
      
      if (success) {
        // Dispatch input event to notify React of the change
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
      }
      
      return success;
    } catch (error) {
      console.warn('Undo command failed:', error);
      return false;
    }
  }
  
  return false;
}

/**
 * Execute redo command on textarea
 */
function executeRedoCommand(element: HTMLTextAreaElement | HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
    try {
      // Focus the element first
      element.focus();
      
      // Execute the redo command
      // This works in most browsers for textarea and contenteditable
      const success = document.execCommand('redo');
      
      if (success) {
        // Dispatch input event to notify React of the change
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
      }
      
      return success;
    } catch (error) {
      console.warn('Redo command failed:', error);
      return false;
    }
  }
  
  return false;
}

/**
 * Execute new paragraph command
 */
function executeNewParagraphCommand(
  element: HTMLTextAreaElement | HTMLElement
): boolean {
  if (element instanceof HTMLTextAreaElement) {
    const cursorPos = element.selectionStart;
    const beforeCursor = element.value.substring(0, cursorPos);
    const afterCursor = element.value.substring(element.selectionEnd);
    
    // Add two newlines for paragraph break
    const newText = '\n\n';
    element.setRangeText(newText, cursorPos, element.selectionEnd, 'end');
    
    return true;
  }
  
  // For contenteditable
  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Create paragraph break
      const br1 = document.createElement('br');
      const br2 = document.createElement('br');
      range.insertNode(br2);
      range.insertNode(br1);
      
      // Position cursor after the break
      range.setStartAfter(br2);
      range.setEndAfter(br2);
      selection.removeAllRanges();
      selection.addRange(range);
      
      return true;
    }
  }
  
  return false;
}

/**
 * Execute new line command
 */
function executeNewLineCommand(
  element: HTMLTextAreaElement | HTMLElement
): boolean {
  if (element instanceof HTMLTextAreaElement) {
    const cursorPos = element.selectionStart;
    element.setRangeText('\n', cursorPos, element.selectionEnd, 'end');
    return true;
  }
  
  // For contenteditable
  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const br = document.createElement('br');
      range.insertNode(br);
      
      range.setStartAfter(br);
      range.setEndAfter(br);
      selection.removeAllRanges();
      selection.addRange(range);
      
      return true;
    }
  }
  
  return false;
}

/**
 * Convert o'clock positions to digital time format
 * Handles: "4 o'clock", "four o'clock", "12 o'clock" → "4:00", "4:00", "12:00"
 */
export function convertOClockToTime(text: string): string {
  // First handle number words + o'clock
  let result = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+o['']?\s*clock\b/gi, 
    (match, numberWord) => {
      const num = convertSingleNumberWord(numberWord);
      return `${num}:00`;
    }
  );
  
  // Then handle digit + o'clock
  result = result.replace(/\b(\d{1,2})\s+o['']?\s*clock\b/gi, '$1:00');
  
  return result;
}

/**
 * Convert dimension expressions
 * Handles: "five by four by three" → "5 x 4 x 3"
 */
export function convertDimensions(text: string): string {
  // Convert patterns like "number by number by number" → "number x number x number"
  // This regex captures numbers (digits or spelled out) separated by "by"
  return text.replace(/\b(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s+by\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:\s+by\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*/gi, 
    (match) => {
      return match.replace(/\s+by\s+/gi, ' x ');
    }
  );
}

/**
 * Convert number words to digits in text
 * Handles: "five point two" → "5.2", "twenty three" → "23", etc.
 */
export function convertNumberWords(text: string): string {
  let result = text;
  
  // First handle dimensions before individual number conversion
  result = convertDimensions(result);
  
  // Handle decimal patterns like "five point two" → "5.2"
  result = result.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(?:point|decimal)\s+(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi, (match, whole, decimal) => {
    const wholeNum = convertSingleNumberWord(whole);
    const decimalNum = convertSingleNumberWord(decimal);
    return `${wholeNum}.${decimalNum}`;
  });
  
  // Handle compound numbers like "twenty one" → "21", "thirty five" → "35"
  result = result.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(one|two|three|four|five|six|seven|eight|nine)\b/gi, (match, tens, ones) => {
    const tensNum = convertSingleNumberWord(tens);
    const onesNum = convertSingleNumberWord(ones);
    return (tensNum + onesNum).toString();
  });
  
  // Handle hundreds like "one hundred" → "100", "two hundred fifty" → "250"
  result = result.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?)?\b/gi, (match, hundreds, tens, ones) => {
    let total = convertSingleNumberWord(hundreds) * 100;
    if (tens) total += convertSingleNumberWord(tens);
    if (ones) total += convertSingleNumberWord(ones);
    return total.toString();
  });
  
  // Handle basic number words
  result = result
    .replace(VOICE_COMMANDS.ZERO, '0')
    .replace(VOICE_COMMANDS.ONE, '1')
    .replace(VOICE_COMMANDS.TWO, '2')
    .replace(VOICE_COMMANDS.THREE, '3')
    .replace(VOICE_COMMANDS.FOUR, '4')
    .replace(VOICE_COMMANDS.FIVE, '5')
    .replace(VOICE_COMMANDS.SIX, '6')
    .replace(VOICE_COMMANDS.SEVEN, '7')
    .replace(VOICE_COMMANDS.EIGHT, '8')
    .replace(VOICE_COMMANDS.NINE, '9')
    .replace(VOICE_COMMANDS.TEN, '10')
    .replace(VOICE_COMMANDS.ELEVEN, '11')
    .replace(VOICE_COMMANDS.TWELVE, '12')
    .replace(VOICE_COMMANDS.THIRTEEN, '13')
    .replace(VOICE_COMMANDS.FOURTEEN, '14')
    .replace(VOICE_COMMANDS.FIFTEEN, '15')
    .replace(VOICE_COMMANDS.SIXTEEN, '16')
    .replace(VOICE_COMMANDS.SEVENTEEN, '17')
    .replace(VOICE_COMMANDS.EIGHTEEN, '18')
    .replace(VOICE_COMMANDS.NINETEEN, '19')
    .replace(VOICE_COMMANDS.TWENTY, '20')
    .replace(VOICE_COMMANDS.THIRTY, '30')
    .replace(VOICE_COMMANDS.FORTY, '40')
    .replace(VOICE_COMMANDS.FIFTY, '50')
    .replace(VOICE_COMMANDS.SIXTY, '60')
    .replace(VOICE_COMMANDS.SEVENTY, '70')
    .replace(VOICE_COMMANDS.EIGHTY, '80')
    .replace(VOICE_COMMANDS.NINETY, '90')
    .replace(VOICE_COMMANDS.HUNDRED, '100')
    .replace(VOICE_COMMANDS.THOUSAND, '1000');
  
  return result;
}

/**
 * Convert a single number word to its numeric value
 */
function convertSingleNumberWord(word: string): number {
  const lowerWord = word.toLowerCase();
  switch (lowerWord) {
    case 'zero': return 0;
    case 'one': return 1;
    case 'two': return 2;
    case 'three': return 3;
    case 'four': return 4;
    case 'five': return 5;
    case 'six': return 6;
    case 'seven': return 7;
    case 'eight': return 8;
    case 'nine': return 9;
    case 'ten': return 10;
    case 'eleven': return 11;
    case 'twelve': return 12;
    case 'thirteen': return 13;
    case 'fourteen': return 14;
    case 'fifteen': return 15;
    case 'sixteen': return 16;
    case 'seventeen': return 17;
    case 'eighteen': return 18;
    case 'nineteen': return 19;
    case 'twenty': return 20;
    case 'thirty': return 30;
    case 'forty': return 40;
    case 'fifty': return 50;
    case 'sixty': return 60;
    case 'seventy': return 70;
    case 'eighty': return 80;
    case 'ninety': return 90;
    default: return 0;
  }
}

/**
 * Convert standalone "slash" tokens to "/" in the text
 * Only converts word-boundary "slash", leaves "slasher", "backslash" etc. intact
 */
export function convertSlashTokens(text: string): string {
  return text.replace(/\bslash\b/gi, '/');
}

/**
 * Apply boundary-only spacing normalization around inserted text
 * Only examines and modifies at most 1 character before and after the insertion
 */
function normalizeBoundarySpacing(
  fullText: string,
  insertStart: number,
  insertEnd: number,
  insertedText: string
): { text: string; caretOffset: number } {
  if (fullText.length === 0 || insertedText.length === 0) {
    return { text: fullText, caretOffset: 0 };
  }

  let result = fullText;
  let caretOffset = 0;

  // Get boundary characters
  const leftChar = insertStart > 0 ? fullText[insertStart - 1] : '';
  const rightChar = insertEnd < fullText.length ? fullText[insertEnd] : '';
  const insertFirstChar = insertedText[0];
  const insertLastChar = insertedText[insertedText.length - 1];

  // Left boundary normalization - ensure proper spacing
  if (leftChar && insertFirstChar) {
    // Need space if:
    // 1. Previous char is alphanumeric AND inserted text starts with alphanumeric
    // 2. Previous char is punctuation (except open paren/bracket) AND inserted text starts with alphanumeric
    const needsSpace = (isAlphanumeric(leftChar) && isAlphanumeric(insertFirstChar) && 
                       leftChar !== '/' && insertFirstChar !== '/') ||
                       (isPunctuation(leftChar) && !['(', '[', '{'].includes(leftChar) && isAlphanumeric(insertFirstChar));
    const hasSpace = leftChar === ' ';

    if (needsSpace && !hasSpace) {
      // Insert space before
      result = result.substring(0, insertStart) + ' ' + result.substring(insertStart);
      caretOffset += 1;
      insertEnd += 1; // Adjust for the space we added
    } else if (!needsSpace && hasSpace && insertStart > 1) {
      // Check if we should remove the space
      const charBeforeSpace = fullText[insertStart - 2];
      if (!isAlphanumeric(charBeforeSpace) || charBeforeSpace === '/' || insertFirstChar === '/' || 
          ['(', '[', '{'].includes(insertFirstChar)) {
        // Remove the space
        result = result.substring(0, insertStart - 1) + result.substring(insertStart);
        caretOffset -= 1;
        insertEnd -= 1;
      }
    }
  }

  // Right boundary normalization - ALWAYS ensure space between words
  if (rightChar && insertLastChar) {
    const adjustedRightPos = insertEnd + caretOffset;
    const currentRightChar = adjustedRightPos < result.length ? result[adjustedRightPos] : '';
    
    // Need space if:
    // 1. Inserted text ends with alphanumeric AND next char is alphanumeric
    // 2. Inserted text ends with punctuation AND next char is alphanumeric (except slash)
    const needsSpace = (isAlphanumeric(insertLastChar) && isAlphanumeric(currentRightChar) && 
                       insertLastChar !== '/' && currentRightChar !== '/') ||
                       (isPunctuation(insertLastChar) && isAlphanumeric(currentRightChar));
    const hasSpace = currentRightChar === ' ';

    if (needsSpace && !hasSpace) {
      // Insert space after
      result = result.substring(0, adjustedRightPos) + ' ' + result.substring(adjustedRightPos);
    } else if (!needsSpace && hasSpace && !isAlphanumeric(currentRightChar)) {
      // Only remove space if next char is not alphanumeric
      result = result.substring(0, adjustedRightPos) + result.substring(adjustedRightPos + 1);
    }
  }

  // Remove spaces around "/" (slash as joiner rule)
  // Only process the immediate area around the insertion to avoid affecting the whole text
  const processStart = Math.max(0, insertStart - 2);
  const processEnd = Math.min(result.length, insertEnd + caretOffset + 2);
  
  if (processEnd > processStart) {
    const beforeProcess = result.substring(0, processStart);
    const processArea = result.substring(processStart, processEnd);
    const afterProcess = result.substring(processEnd);
    
    const cleanedArea = processArea.replace(/\s*\/\s*/g, '/');
    result = beforeProcess + cleanedArea + afterProcess;
    
    // Adjust caret offset if spaces were removed
    const spacesRemoved = processArea.length - cleanedArea.length;
    if (spacesRemoved > 0 && insertStart >= processStart) {
      // Only adjust if the removal was before our insertion point
      const removalInLeft = Math.max(0, insertStart - processStart);
      if (removalInLeft > 0) {
        caretOffset -= Math.min(spacesRemoved, removalInLeft);
      }
    }
  }

  // Apply capitalization rules after spacing normalization
  result = applyCapitalization(result, insertStart, insertEnd + caretOffset);
  
  return { text: result, caretOffset };
}

/**
 * Process dictation with voice commands
 */
export function processDictationWithCommands(
  element: HTMLTextAreaElement | HTMLElement,
  rawText: string
): { success: boolean; newCaretPos: number; commandExecuted?: string } {
  if (!element) {
    return { success: false, newCaretPos: 0 };
  }

  // Process voice commands first
  const commandResult = processVoiceCommands(rawText);
  
  switch (commandResult.type) {
    case 'DELETE_THAT':
      if (element instanceof HTMLTextAreaElement) {
        const success = executeDeleteCommand(element);
        return { 
          success, 
          newCaretPos: element.selectionStart,
          commandExecuted: 'delete'
        };
      } else if (element.isContentEditable) {
        // Handle contentEditable elements
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          if (!range.collapsed) {
            // There is selected text - delete it
            range.deleteContents();
            
            // Trigger input event
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
            
            return {
              success: true,
              newCaretPos: 0,
              commandExecuted: 'delete'
            };
          } else {
            // No selection - delete word before cursor
            const container = range.startContainer;
            if (container.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
              const text = container.textContent || '';
              let deleteStart = range.startOffset - 1;
              
              // Find word boundary
              while (deleteStart > 0 && /\s/.test(text[deleteStart])) {
                deleteStart--;
              }
              while (deleteStart > 0 && /\S/.test(text[deleteStart - 1])) {
                deleteStart--;
              }
              
              // Delete the word
              (container as Text).deleteData(deleteStart, range.startOffset - deleteStart);
              
              // Set cursor position
              range.setStart(container, deleteStart);
              range.setEnd(container, deleteStart);
              selection.removeAllRanges();
              selection.addRange(range);
              
              // Trigger input event
              const event = new Event('input', { bubbles: true });
              element.dispatchEvent(event);
              
              return {
                success: true,
                newCaretPos: 0,
                commandExecuted: 'delete'
              };
            }
          }
        }
      }
      return { success: false, newCaretPos: 0 };
      
    case 'UNDO_THAT':
      const undoSuccess = executeUndoCommand(element);
      return { 
        success: undoSuccess, 
        newCaretPos: 0,
        commandExecuted: 'undo'
      };
      
    case 'REDO_THAT':
      const redoSuccess = executeRedoCommand(element);
      return { 
        success: redoSuccess, 
        newCaretPos: 0,
        commandExecuted: 'redo'
      };
      
    case 'NEW_PARAGRAPH':
      const paragraphSuccess = executeNewParagraphCommand(element);
      return { 
        success: paragraphSuccess, 
        newCaretPos: 0,
        commandExecuted: 'newParagraph'
      };
      
    case 'NEW_LINE':
      const lineSuccess = executeNewLineCommand(element);
      return { 
        success: lineSuccess, 
        newCaretPos: 0,
        commandExecuted: 'newLine'
      };
      
    case 'PUNCTUATION':
    case 'TEXT':
      // Process as regular text with punctuation replacements
      const textToInsert = commandResult.remainingText || rawText;
      
      if (element instanceof HTMLTextAreaElement) {
        return insertDictationInTextarea(element, textToInsert);
      } else if (element.isContentEditable) {
        return insertDictationInContentEditable(element, textToInsert);
      }
      
      return { success: false, newCaretPos: 0 };
      
    default:
      return { success: false, newCaretPos: 0 };
  }
}

/**
 * Expand partial selection to include complete words
 * When text is partially selected, expand the selection to include complete words
 */
function expandSelectionToCompleteWords(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  // If nothing is selected, return as-is
  if (start === end) {
    return { start, end };
  }
  
  let newStart = start;
  let newEnd = end;
  
  // Expand start backwards to beginning of word if we're in the middle of a word
  while (newStart > 0 && isAlphanumeric(text[newStart - 1])) {
    newStart--;
  }
  
  // Expand end forwards to end of word if we're in the middle of a word
  while (newEnd < text.length && isAlphanumeric(text[newEnd])) {
    newEnd++;
  }
  
  return { start: newStart, end: newEnd };
}

/**
 * Insert dictation text in a textarea using exact selection replacement
 */
export function insertDictationInTextarea(
  textarea: HTMLTextAreaElement,
  rawText: string
): { success: boolean; newCaretPos: number } {
  if (!textarea) {
    return { success: false, newCaretPos: 0 };
  }

  // Convert numbers, slash tokens, o'clock, and other conversions before insertion
  let processedText = convertNumberWords(rawText);
  processedText = convertOClockToTime(processedText);
  processedText = convertSlashTokens(processedText);
  
  let selectionStart = textarea.selectionStart;
  let selectionEnd = textarea.selectionEnd;
  const currentValue = textarea.value;
  
  // If text is selected, expand selection to complete words
  if (selectionStart !== selectionEnd) {
    const expanded = expandSelectionToCompleteWords(currentValue, selectionStart, selectionEnd);
    selectionStart = expanded.start;
    selectionEnd = expanded.end;
  }
  
  // Special case: if cursor is between two words with no space, add spaces
  let textToInsert = processedText;
  if (selectionStart === selectionEnd && selectionStart > 0 && selectionStart < currentValue.length) {
    const charBefore = currentValue[selectionStart - 1];
    const charAfter = currentValue[selectionStart];
    
    // If we're between two alphanumeric characters, ensure spaces
    if (isAlphanumeric(charBefore) && isAlphanumeric(charAfter)) {
      // Add spaces around the inserted text
      if (!processedText.startsWith(' ')) {
        textToInsert = ' ' + textToInsert;
      }
      if (!processedText.endsWith(' ')) {
        textToInsert = textToInsert + ' ';
      }
    }
  }

  // Use setRangeText for precise replacement - this maintains undo/redo
  textarea.setRangeText(textToInsert, selectionStart, selectionEnd, 'end');
  
  // Get the updated value after browser's native insertion
  const newValue = textarea.value;
  const insertEnd = selectionStart + textToInsert.length;
  
  // Apply boundary-only normalization
  const { text: normalizedText, caretOffset } = normalizeBoundarySpacing(
    newValue,
    selectionStart,
    insertEnd,
    textToInsert
  );
  
  // If normalization made changes, apply them
  if (normalizedText !== newValue) {
    const caretPos = textarea.selectionStart;
    textarea.value = normalizedText;
    
    // Restore caret position with adjustment
    const finalCaretPos = caretPos + caretOffset;
    textarea.setSelectionRange(finalCaretPos, finalCaretPos);
  }

  return { 
    success: true, 
    newCaretPos: textarea.selectionStart 
  };
}

/**
 * Expand range to include complete words in contentEditable
 */
function expandRangeToCompleteWords(range: Range): void {
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;
  
  // If range is collapsed, don't expand
  if (range.collapsed) {
    return;
  }
  
  // Expand start of range
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = (startContainer as Text).data;
    let newStartOffset = startOffset;
    
    // Expand backwards to beginning of word
    while (newStartOffset > 0 && isAlphanumeric(text[newStartOffset - 1])) {
      newStartOffset--;
    }
    
    if (newStartOffset !== startOffset) {
      range.setStart(startContainer, newStartOffset);
    }
  }
  
  // Expand end of range
  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = (endContainer as Text).data;
    let newEndOffset = endOffset;
    
    // Expand forwards to end of word
    while (newEndOffset < text.length && isAlphanumeric(text[newEndOffset])) {
      newEndOffset++;
    }
    
    if (newEndOffset !== endOffset) {
      range.setEnd(endContainer, newEndOffset);
    }
  }
}

/**
 * Insert dictation text in a contenteditable element using exact Range replacement
 */
export function insertDictationInContentEditable(
  element: HTMLElement,
  rawText: string
): { success: boolean; newCaretPos: number } {
  if (!element) {
    return { success: false, newCaretPos: 0 };
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { success: false, newCaretPos: 0 };
  }

  // Get the range and expand to complete words if needed
  const range = selection.getRangeAt(0);
  
  // If text is selected, expand to complete words
  if (!range.collapsed) {
    expandRangeToCompleteWords(range);
  }
  
  // Convert numbers, slash tokens, o'clock, and other conversions before insertion
  let processedText = convertNumberWords(rawText);
  processedText = convertOClockToTime(processedText);
  processedText = convertSlashTokens(processedText);
  
  // Store position info before modification
  const startContainer = range.startContainer;
  const startOffset = range.startOffset;
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;
  
  // Get text context for boundary normalization
  let leftChar = '';
  let rightChar = '';
  
  if (startContainer.nodeType === Node.TEXT_NODE) {
    leftChar = startOffset > 0 ? (startContainer as Text).data[startOffset - 1] : '';
  }
  
  if (endContainer.nodeType === Node.TEXT_NODE) {
    rightChar = endOffset < (endContainer as Text).data.length ? (endContainer as Text).data[endOffset] : '';
  }
  
  // Special case: if cursor is between two words with no space, add spaces
  let textToInsert = processedText;
  const isCollapsed = range.collapsed;
  if (isCollapsed && leftChar && rightChar && isAlphanumeric(leftChar) && isAlphanumeric(rightChar)) {
    // Add spaces around the inserted text
    if (!processedText.startsWith(' ')) {
      textToInsert = ' ' + textToInsert;
    }
    if (!processedText.endsWith(' ')) {
      textToInsert = textToInsert + ' ';
    }
  } else if (!isCollapsed) {
    // When replacing selected text, ensure proper spacing with surrounding text
    if (leftChar && isAlphanumeric(leftChar) && isAlphanumeric(textToInsert[0])) {
      textToInsert = ' ' + textToInsert;
    }
    if (rightChar && isAlphanumeric(rightChar) && isAlphanumeric(textToInsert[textToInsert.length - 1])) {
      textToInsert = textToInsert + ' ';
    }
  }
  
  // Delete the selected content
  range.deleteContents();
  
  // Create a text node with the processed text
  const textNode = document.createTextNode(textToInsert);
  range.insertNode(textNode);
  
  // Collapse to end of insertion
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Apply boundary normalization to adjacent text nodes
  const insertFirstChar = processedText[0];
  const insertLastChar = processedText[processedText.length - 1];
  
  // Left boundary check
  if (leftChar && insertFirstChar) {
    const needsSpace = isAlphanumeric(leftChar) && isAlphanumeric(insertFirstChar) && 
                       leftChar !== '/' && insertFirstChar !== '/';
    
    const prevSibling = textNode.previousSibling;
    if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
      const prevText = (prevSibling as Text).data;
      const lastChar = prevText[prevText.length - 1];
      const hasSpace = lastChar === ' ';
      
      if (needsSpace && !hasSpace) {
        (prevSibling as Text).data = prevText + ' ';
      } else if (!needsSpace && hasSpace && prevText.length > 1) {
        const charBefore = prevText[prevText.length - 2];
        if (!isAlphanumeric(charBefore) || charBefore === '/' || insertFirstChar === '/') {
          (prevSibling as Text).data = prevText.slice(0, -1);
        }
      }
    }
  }
  
  // Right boundary check
  if (rightChar && insertLastChar) {
    const needsSpace = isAlphanumeric(insertLastChar) && isAlphanumeric(rightChar) && 
                       insertLastChar !== '/' && rightChar !== '/';
    
    const nextSibling = textNode.nextSibling;
    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      const nextText = (nextSibling as Text).data;
      const firstChar = nextText[0];
      const hasSpace = firstChar === ' ';
      
      if (needsSpace && !hasSpace) {
        (nextSibling as Text).data = ' ' + nextText;
      } else if (!needsSpace && hasSpace) {
        (nextSibling as Text).data = nextText.slice(1);
      }
    }
  }
  
  // Apply slash spacing rule in the immediate area
  let current = textNode.previousSibling;
  let nodesToCheck = [textNode];
  
  // Collect adjacent text nodes for slash normalization
  while (current && current.nodeType === Node.TEXT_NODE && nodesToCheck.length < 3) {
    nodesToCheck.unshift(current as Text);
    current = current.previousSibling;
  }
  
  current = textNode.nextSibling;
  while (current && current.nodeType === Node.TEXT_NODE && nodesToCheck.length < 5) {
    nodesToCheck.push(current as Text);
    current = current.nextSibling;
  }
  
  // Apply no-space-around-slash rule to collected nodes
  nodesToCheck.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const originalText = (node as Text).data;
      const cleanedText = originalText.replace(/\s*\/\s*/g, '/');
      if (cleanedText !== originalText) {
        (node as Text).data = cleanedText;
      }
    }
  });

  return { 
    success: true, 
    newCaretPos: 0 // Position is maintained by the range/selection
  };
}

/**
 * Generic dictation insertion that detects element type and uses appropriate method
 * This is the main entry point for all dictation processing
 */
export function insertDictationAtCaret(
  element: HTMLTextAreaElement | HTMLInputElement | HTMLElement,
  rawText: string
): { success: boolean; newCaretPos: number; commandExecuted?: string } {
  return processDictationWithCommands(element, rawText);
}

// Export the legacy interface for backward compatibility
export function insertDictationAtCaret_Legacy(
  textarea: HTMLTextAreaElement,
  rawText: string,
  _currentValue: string
): { newValue: string; newCaret: number } {
  const result = insertDictationInTextarea(textarea, rawText);
  return {
    newValue: textarea.value,
    newCaret: result.newCaretPos
  };
}

// Export types for component usage
export interface FindingsEditorHandle {
  insertDictation: (rawText: string) => void;
  getValue: () => string;
  focus: () => void;
}