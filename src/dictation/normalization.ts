// Word to symbol/punctuation replacements
const DEFAULT_REPLACEMENTS: Array<[string, string]> = [
  ['period', '.'],
  ['comma', ','],
  ['question mark', '?'],
  ['exclamation point', '!'],
  ['exclamation mark', '!'],
  ['colon', ':'],
  ['semicolon', ';'],
  ['semi colon', ';'],
  ['dash', '-'],
  ['hyphen', '-'],
  ['slash', '/'],
  ['forward slash', '/'],
  ['backslash', '\\'],
  ['back slash', '\\'],
  ['open parenthesis', '('],
  ['open paren', '('],
  ['close parenthesis', ')'],
  ['close paren', ')'],
  ['quote', '"'],
  ['double quote', '"'],
  ['apostrophe', "'"],
  ['single quote', "'"],
  ['ampersand', '&'],
  ['at sign', '@'],
  ['percent', '%'],
  ['percent sign', '%'],
  ['plus', '+'],
  ['plus sign', '+'],
  ['equals', '='],
  ['equal sign', '='],
  ['new line', '\n'],
  ['newline', '\n'],
  ['paragraph', '\n\n'],
  ['new paragraph', '\n\n'],
];

// Number word to digit conversion
const NUMBER_WORDS: { [key: string]: string } = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
  'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
  'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
  'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
  'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000',
  'million': '1000000'
};

export function normalizeTranscript(
  raw: string, 
  custom?: Array<[string, string]>
): string {
  let processed = raw.trim();
  
  if (!processed) return '';

  // Convert number words to digits
  processed = convertNumberWords(processed);

  // Apply default word replacements
  for (const [word, replacement] of DEFAULT_REPLACEMENTS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    processed = processed.replace(regex, replacement);
  }

  // Apply custom replacements if provided
  if (custom) {
    for (const [word, replacement] of custom) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      processed = processed.replace(regex, replacement);
    }
  }

  // Collapse repeated whitespace
  processed = processed.replace(/\s+/g, ' ');

  return processed;
}

function convertNumberWords(text: string): string {
  let processed = text;
  
  // Handle decimal numbers (e.g., "five point four" -> "5.4")
  const decimalPattern = new RegExp(
    `\\b(${Object.keys(NUMBER_WORDS).join('|')})\\s+point\\s+(${Object.keys(NUMBER_WORDS).join('|')})(\\s+(${Object.keys(NUMBER_WORDS).slice(0, 10).join('|')}))*\\b`,
    'gi'
  );
  
  processed = processed.replace(decimalPattern, (match, whole, decimal1, rest, decimal2) => {
    let result = NUMBER_WORDS[whole.toLowerCase()] || whole;
    result += '.';
    result += NUMBER_WORDS[decimal1.toLowerCase()] || decimal1;
    if (decimal2) {
      result += NUMBER_WORDS[decimal2.toLowerCase()] || decimal2;
    }
    return result;
  });
  
  // Handle compound numbers (e.g., "twenty-one" -> "21")
  processed = processed.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (match, tens, ones) => {
      const tensNum = parseInt(NUMBER_WORDS[tens.toLowerCase()] || '0');
      const onesNum = parseInt(NUMBER_WORDS[ones.toLowerCase()] || '0');
      return (tensNum + onesNum).toString();
    }
  );
  
  // Replace standalone number words
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    processed = processed.replace(regex, digit);
  }
  
  return processed;
}

export function applySmartSpacing(
  leftContext: string,
  insertText: string,
  rightContext: string
): { textToInsert: string; leftTrim: number; rightTrim: number } {
  let textToInsert = insertText;
  let leftTrim = 0;
  let rightTrim = 0;

  // Handle newlines specially - trim surrounding spaces
  if (textToInsert === '\n' || textToInsert === '\n\n') {
    // Count trailing spaces in left context
    const leftSpaces = leftContext.match(/\s*$/)?.[0].length || 0;
    leftTrim = Math.min(leftSpaces, 2); // Limit trim to avoid over-deletion
    
    // Count leading spaces in right context
    const rightSpaces = rightContext.match(/^\s*/)?.[0].length || 0;
    rightTrim = Math.min(rightSpaces, 2); // Limit trim to avoid over-deletion
    
    return { textToInsert, leftTrim, rightTrim };
  }

  const leftChar = leftContext[leftContext.length - 1] || '';
  const rightChar = rightContext[0] || '';
  
  // Check if characters are word characters
  const isWordChar = (char: string) => /[A-Za-z0-9]/.test(char);
  const isPunctuation = (char: string) => /[.,;:!?]/.test(char);

  // Simple spacing rules
  // Add space before if left ends with word char and insert starts with word char
  if (leftContext.length > 0 && isWordChar(leftChar) && isWordChar(textToInsert[0])) {
    textToInsert = ' ' + textToInsert;
  }
  
  // Remove space before punctuation
  if (isPunctuation(textToInsert[0]) && leftChar === ' ') {
    leftTrim = 1;
  }

  // Capitalize if at beginning or after sentence end
  const sentenceEnd = /[.!?]\s*$/;
  if (leftContext.length === 0 || sentenceEnd.test(leftContext)) {
    if (textToInsert.length > 0 && /[a-z]/.test(textToInsert[0])) {
      // Add space after sentence end if not already there
      if (leftContext.length > 0 && /[.!?]$/.test(leftContext)) {
        textToInsert = ' ' + textToInsert;
      }
      // Capitalize first letter
      const spacePrefix = textToInsert[0] === ' ' ? ' ' : '';
      const textPart = textToInsert[0] === ' ' ? textToInsert.slice(1) : textToInsert;
      textToInsert = spacePrefix + textPart.charAt(0).toUpperCase() + textPart.slice(1);
    }
  }

  return { textToInsert, leftTrim, rightTrim };
}

export function expandToWordBoundaries(
  fullText: string,
  selStart: number,
  selEnd: number
): { start: number; end: number } {
  // Word characters include letters, numbers, underscore, apostrophe, hyphen
  const isWordChar = (char: string) => /[A-Za-z0-9_''-]/.test(char);
  
  let start = selStart;
  let end = selEnd;

  // If we have a selection (not just caret)
  if (selStart !== selEnd) {
    // Expand start to beginning of word
    while (start > 0 && isWordChar(fullText[start - 1])) {
      start--;
    }

    // Expand end to end of word
    while (end < fullText.length && isWordChar(fullText[end])) {
      end++;
    }
  }

  return { start, end };
}