class RadiologyTextProcessor {
  constructor() {
    // Spine level patterns
    this.spinePatterns = {
      // Pattern for "C3-four" or "C3-4" -> "C3-4"
      mixedHyphenated: /\b([CTLS])(\d+)-(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/gi,
      
      // Pattern for "C three hyphen C four" -> "C3-C4"
      hyphenatedLevels: /\b([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s*hyphen\s*([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/gi,
      
      // Pattern for "C three, C four" or "C three C four" -> "C3-C4"  
      // Also handles cross-segment transitions like "C seven T one" -> "C7-T1"
      consecutiveLevels: /\b([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)[\s,]+(?:and\s+)?([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/gi,
      
      // Pattern for "C three four" or "C 3 4" -> "C3-C4"
      rangedLevels: /\b([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/gi,
      
      // Pattern for standalone levels like "C three" -> "C3"
      singleLevel: /\b([CTLS])\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
      
      // Pattern for fixing spacing issues like "C3hyphenC4" -> "C3-C4"
      fixHyphenSpacing: /\b([CTLS]\d+)hyphen([CTLS]\d+)\b/gi,
      
      // Pattern for "T 12" -> "T12"
      fixNumberSpacing: /\b([CTLS])\s+(\d+)\b/g,
      
      // Pattern for "C3C4" -> "C3-C4" (no space between)
      noSpaceBetween: /\b([CTLS])(\d+)([CTLS])(\d+)\b/g,
      
      // Pattern for "l two three" (lowercase L) -> "L2-3"
      lowercaseL: /\b(l)\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)/gi,
      
      // Pattern for "C71" -> "C7-T1" (Deepgram sometimes concatenates cross-segment levels)
      concatenatedCrossSegment: /\b(C)71\b/g,
      
      // Pattern for "T121" -> "T12-L1"
      concatenatedT12L1: /\b(T)121\b/g,
      
      // Pattern for "L51" -> "L5-S1"
      concatenatedL5S1: /\b(L)51\b/g,
      
      // Pattern for isolated "hyphen" followed by segment-number
      isolatedHyphen: /\bhyphen\s+([stls])(\d+)/gi
    };

    // Number word to digit mapping
    this.numberWords = {
      'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
      'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
      'eleven': '11', 'twelve': '12'
    };

    // Common radiology abbreviations that should be uppercase
    this.upperCaseTerms = [
      'MRI', 'CT', 'AP', 'PA', 'LAT', 'LATERAL', 'FLAIR', 'T1', 'T2', 
      'DWI', 'ADC', 'GRE', 'STIR', 'PET', 'SPECT', 'IV', 'PO', 'IM',
      'ACL', 'PCL', 'MCL', 'LCL', 'TFCC', 'SLAP', 'HNP'
    ];

    // Punctuation and formatting commands (PowerScribe/Fluency style)
    this.formattingCommands = {
      // Punctuation
      period: /\b(period|full stop)\b/gi,
      comma: /\bcomma\b/gi,
      colon: /\bcolon\b/gi,
      semicolon: /\bsemicolon\b/gi,
      questionMark: /\bquestion mark\b/gi,
      exclamation: /\bexclamation mark\b/gi,
      openParen: /\b(open paren|left paren|open parenthesis)\b/gi,
      closeParen: /\b(close paren|right paren|close parenthesis)\b/gi,
      dash: /\b(dash|hyphen)\b/gi,
      slash: /\bslash\b/gi,
      percentage: /\b(percentage|percent)\b/gi,
      
      // Line breaks and paragraphs
      newLine: /\b(new line|line break|next line)\b/gi,
      newParagraph: /\b(paragraph|new paragraph|next paragraph)\b/gi,
      
      // Remove any existing punctuation that Deepgram might add
      existingPunctuation: /[.,;:!?]/g
    };
    
    // Metric units mapping
    this.metricUnits = {
      'millimeter': 'mm',
      'millimeters': 'mm',
      'centimeter': 'cm',
      'centimeters': 'cm',
      'meter': 'm',
      'meters': 'm'
    };

    // Contraction expansions for medical dictation
    this.contractions = {
      "aren't": "are not",
      "can't": "cannot",
      "couldn't": "could not",
      "didn't": "did not",
      "doesn't": "does not",
      "don't": "do not",
      "hadn't": "had not",
      "hasn't": "has not",
      "haven't": "have not",
      "he's": "he is",
      "i'd": "I would",
      "i'll": "I will",
      "i'm": "I am",
      "i've": "I have",
      "isn't": "is not",
      "it's": "it is",
      "let's": "let us",
      "she's": "she is",
      "shouldn't": "should not",
      "that's": "that is",
      "there's": "there is",
      "they'd": "they would",
      "they'll": "they will",
      "they're": "they are",
      "they've": "they have",
      "we'd": "we would",
      "we'll": "we will",
      "we're": "we are",
      "we've": "we have",
      "weren't": "were not",
      "what's": "what is",
      "where's": "where is",
      "who's": "who is",
      "won't": "will not",
      "wouldn't": "would not",
      "you'd": "you would",
      "you'll": "you will",
      "you're": "you are",
      "you've": "you have"
    };
  }

  // Convert number words to digits
  convertNumberWord(word) {
    const lower = word.toLowerCase();
    return this.numberWords[lower] || word;
  }

  // Check if this is a valid spine segment transition
  isValidSpineTransition(seg1, num1, seg2, num2) {
    const n1 = parseInt(num1);
    const n2 = parseInt(num2);
    
    // Define valid spine segment ranges
    const spineRanges = {
      'C': { min: 1, max: 7 },   // Cervical: C1-C7
      'T': { min: 1, max: 12 },  // Thoracic: T1-T12
      'L': { min: 1, max: 5 },   // Lumbar: L1-L5
      'S': { min: 1, max: 5 }    // Sacral: S1-S5
    };
    
    // Define spine segment hierarchy (anatomical order)
    const segmentOrder = ['C', 'T', 'L', 'S'];
    const seg1Index = segmentOrder.indexOf(seg1);
    const seg2Index = segmentOrder.indexOf(seg2);
    
    // Check if both segments are valid
    if (seg1Index === -1 || seg2Index === -1) return false;
    
    // Check if numbers are within valid ranges for their segments
    if (n1 < spineRanges[seg1].min || n1 > spineRanges[seg1].max) return false;
    if (n2 < spineRanges[seg2].min || n2 > spineRanges[seg2].max) return false;
    
    // Allow transitions within the same segment (handled elsewhere)
    if (seg1 === seg2) return false;
    
    // Allow any cross-segment range that follows anatomical order
    // Examples: C2-T11, T5-L3, L2-S1, C3-S2, etc.
    if (seg1Index < seg2Index) {
      return true; // Forward direction (C->T->L->S)
    }
    
    // Allow reverse direction for some cases (like reporting ranges)
    // Examples: T1-C7, L1-T12, S1-L5
    if (seg1Index > seg2Index) {
      return true; // Reverse direction
    }
    
    return false;
  }

  // Expand contractions to full words
  expandContractions(text) {
    let processed = text;
    
    // Replace contractions with full words
    Object.keys(this.contractions).forEach(contraction => {
      const expansion = this.contractions[contraction];
      // Case-insensitive replacement
      const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
      processed = processed.replace(regex, expansion);
    });
    
    return processed;
  }

  // Apply proper capitalization for medical dictation
  applyProperCapitalization(text) {
    let processed = text;
    
    // Only capitalize the very first letter of the entire chunk if it starts with a lowercase letter
    // AND only if it's the beginning of the dictation (position 0)
    if (processed.length > 0 && /^[a-z]/.test(processed)) {
      processed = processed[0].toUpperCase() + processed.slice(1);
    }
    
    // Capitalize first letter after EXPLICIT punctuation (. ! ?) when followed by a space
    // This handles both explicitly dictated periods and proper sentence structure
    // IMPORTANT: Preserve newlines - only replace spaces, not newlines
    processed = processed.replace(/([.!?])\s+([a-z])/g, (match, punctuation, letter, offset) => {
      // Extract the whitespace between punctuation and letter
      const whitespace = match.substring(1, match.length - 1);
      // If it contains newlines, preserve them; otherwise use a single space
      if (whitespace.includes('\n')) {
        return punctuation + whitespace + letter.toUpperCase();
      }
      return punctuation + ' ' + letter.toUpperCase();
    });
    
    // Also capitalize if period is at the very end (for next chunk handling)
    processed = processed.replace(/([.!?])$/g, '$1');
    
    // Capitalize first letter after paragraph breaks
    processed = processed.replace(/(\n\n)([a-z])/g, (match, newlines, letter) => {
      return newlines + letter.toUpperCase();
    });
    
    // Capitalize "I" when it appears alone (not part of another word)
    processed = processed.replace(/\bi\b/g, 'I');
    
    return processed;
  }

  // Process formatting commands (PowerScribe/Fluency style)
  processFormattingCommands(text) {
    let processed = text;
    
    // Pre-process common mistranscriptions of "delete that"
    // Handle variations like "Dolita", "dolita", "delete a", "delete at", etc.
    processed = processed.replace(/^\s*(dolita|dalita|delete a|delete at|dilita|delita|delete the|delete dad|delete bad)\s*$/i, 'delete that');
    processed = processed.replace(/^\s*(clear the|clear at|clear a|remove the|remove a)\s*$/i, 'delete that');
    
    // Check if this is a delete command - don't process it as regular text
    // Expanded pattern to catch more variations
    if (/^\s*(delete\s*(that|this|it|those|these|all)?|clear\s*(that|this|it|all)?|remove\s*(that|this|it|all)?|erase\s*(that|this|it|all)?)\s*$/i.test(processed)) {
      // Normalize to "delete that" for consistent frontend handling
      return 'delete that';
    }
    
    // Check if this is a macro command - don't process it as regular text
    // Matches "macro <name>" or common mistranscriptions
    if (/^\s*(macro|micro|mackerel|macaroni|mccrow|macrow|makro)\s+[a-zA-Z0-9_-]+\s*$/i.test(processed)) {
      // Return as-is for frontend to handle as macro command
      return processed;
    }
    
    // Also check for macro at the end of a sentence
    if (/\s+(macro|micro|mackerel|macaroni|mccrow|macrow|makro)\s+[a-zA-Z0-9_-]+\s*$/i.test(processed)) {
      // Return as-is for frontend to handle
      return processed;
    }

    // DON'T remove existing punctuation - Deepgram is set to punctuate=false
    // so any punctuation that exists was explicitly dictated
    // processed = processed.replace(this.formattingCommands.existingPunctuation, '');

    // IMPORTANT: Handle line breaks and paragraphs BEFORE converting punctuation words
    // Otherwise "period paragraph" becomes ". paragraph" and won't match
    
    // Handle "period paragraph" and "period new line" patterns first
    processed = processed.replace(/\bperiod\s+(paragraph|new\s+paragraph|next\s+paragraph)\b/gi, '.\n\n');
    processed = processed.replace(/\bperiod\s+(new\s+line|line\s+break|next\s+line)\b/gi, '.\n');
    
    // Handle "comma paragraph" and "comma new line" patterns
    processed = processed.replace(/\bcomma\s+(paragraph|new\s+paragraph|next\s+paragraph)\b/gi, ',\n\n');
    processed = processed.replace(/\bcomma\s+(new\s+line|line\s+break|next\s+line)\b/gi, ',\n');
    
    // Then handle standalone paragraph/new line commands
    processed = processed.replace(/\b(new\s+paragraph|next\s+paragraph|paragraph)\b/gi, '\n\n');
    processed = processed.replace(/\b(new\s+line|line\s+break|next\s+line)\b/gi, '\n');

    // NOW handle remaining punctuation commands - replace words with punctuation
    // IMPORTANT: Always ensure a space after punctuation to handle pause-separated chunks
    processed = processed.replace(/\s*(period|full stop)\s*/gi, '. ');
    processed = processed.replace(/\s*comma\s*/gi, ', ');
    
    // Clean up excessive spacing but preserve single spaces after punctuation
    // Keep trailing spaces after periods/commas for next chunk
    processed = processed.replace(/[ \t]{2,}/g, ' ');  // Replace multiple spaces/tabs with single space (but preserve newlines)
    
    // Fix the specific issue where periods don't have proper spacing before the next sentence
    // Ensure there's ALWAYS a space after periods, even at the end of the chunk
    processed = processed.replace(/\.(?!\s)/g, '. ');  // Add space after period if not present
    processed = processed.replace(/\.\s*([A-Z])/g, '. $1');
    
    // Ensure space after other sentence-ending punctuation
    processed = processed.replace(/([!?])(?!\s)/g, '$1 ');  // Add space if not present
    processed = processed.replace(/([!?])([A-Z])/g, '$1 $2');
    processed = processed.replace(/,(?!\s)/g, ', ');  // Ensure space after comma
    processed = processed.replace(/([,;:])([A-Za-z])/g, '$1 $2')
    
    // Handle other punctuation with consistent spacing
    processed = processed.replace(/\s*colon\s*/gi, ': ');
    processed = processed.replace(/\s*semicolon\s*/gi, '; ');
    processed = processed.replace(/\s*question mark\s*/gi, '? ');
    processed = processed.replace(/\s*exclamation mark\s*/gi, '! ');
    
    // Clean up trailing spaces for punctuation at the end
    processed = processed.replace(/:\s+$/g, ':');
    processed = processed.replace(/;\s+$/g, ';');
    processed = processed.replace(/\?\s+$/g, '?');
    processed = processed.replace(/!\s+$/g, '!');
    
    // For parentheses, we might want to keep the space before open paren
    processed = processed.replace(this.formattingCommands.openParen, ' (');
    processed = processed.replace(/\s+\(/g, ' ('); // Normalize to single space
    
    processed = processed.replace(/\s+(close paren|right paren|close parenthesis)\b/gi, ')');
    processed = processed.replace(/^(close paren|right paren|close parenthesis)\b/gi, ')');
    
    // Handle hyphen/dash - just output a simple hyphen
    processed = processed.replace(/\s*(hyphen|dash)\s*/gi, '-');
    
    // Handle slash - convert word "slash" to "/"
    processed = processed.replace(/\s*slash\s*/gi, '/');
    
    // Handle time format - convert "zero zero" or "0 0" after colon to "00"
    // This handles cases like "12: 0 0" -> "12:00" or "3: zero zero" -> "3:00"
    processed = processed.replace(/(\d{1,2}):\s*(zero\s+zero|0\s+0)/gi, '$1:00');
    processed = processed.replace(/(\d{1,2}):\s*zero\b/gi, '$1:00');  // Handle single "zero" after colon
    
    // Clean up spacing around colons in time format (e.g., "12: 00" -> "12:00")
    processed = processed.replace(/(\d{1,2})\s*:\s*(\d{1,2})/g, '$1:$2');
    
    // Handle percentage
    processed = processed.replace(this.formattingCommands.percentage, '%');

    // Clean up extra spaces around punctuation (but not after periods/commas)
    processed = processed.replace(/\s+([;:!?)])/g, '$1');
    processed = processed.replace(/([(\[])\s+/g, '$1');
    // Don't remove ALL spaces around hyphens - preserve them in compound words
    // Only clean up excessive spaces
    processed = processed.replace(/\s{2,}-/g, ' -'); // Multiple spaces before hyphen
    processed = processed.replace(/-\s{2,}/g, '- '); // Multiple spaces after hyphen

    return processed;
  }

  // Process text for radiology-specific formatting
  processText(text) {
    if (!text) return text;
    
    let processed = text;
    
    // Don't add space at beginning - let the frontend handle spacing between chunks
    // The frontend knows the context better (e.g., if we're at the start of text or after punctuation)

    // First, handle formatting commands (punctuation and line breaks)
    // This converts word "period" to actual "."
    processed = this.processFormattingCommands(processed);

    // Second, expand contractions to full words
    processed = this.expandContractions(processed);
    
    // Convert metric units to abbreviations AFTER we handle dimensions
    // Save this for later after "by" processing
    
    // Fix common medical term mistranscriptions
    processed = processed.replace(/\bchondralabral\b/gi, 'chondrolabral');
    processed = processed.replace(/\bachondralabral\b/gi, 'chondrolabral'); // Another variant
    processed = processed.replace(/\bchondro labral\b/gi, 'chondrolabral'); // With space
    processed = processed.replace(/\bchondral labral\b/gi, 'chondrolabral'); // Another space variant

    // Step 0: Handle special concatenated cross-segment patterns
    processed = processed.replace(this.spinePatterns.concatenatedCrossSegment, 'C7-T1');
    processed = processed.replace(this.spinePatterns.concatenatedT12L1, 'T12-L1');
    processed = processed.replace(this.spinePatterns.concatenatedL5S1, 'L5-S1');
    
    // Handle isolated "hyphen" commands that got separated
    processed = processed.replace(this.spinePatterns.isolatedHyphen, (match, seg, num) => {
      return `-${seg.toUpperCase()}${num}`;
    });

    // Step 0.5: Handle lowercase 'l' -> 'L'
    processed = processed.replace(this.spinePatterns.lowercaseL, (match, seg, num) => {
      const digit = this.convertNumberWord(num);
      return `L${digit}`;
    });
    
    // Step 1: Fix hyphen spacing issues (C3hyphenC4 -> C3-C4)
    processed = processed.replace(this.spinePatterns.fixHyphenSpacing, '$1-$2');
    
    // Step 1.5: Handle "C3-four" -> "C3-4"
    processed = processed.replace(this.spinePatterns.mixedHyphenated, (match, seg, num1, num2) => {
      const digit2 = this.convertNumberWord(num2);
      return `${seg.toUpperCase()}${num1}-${digit2}`;
    });

    // Step 2: Handle "C three hyphen C four" -> "C3-C4"
    processed = processed.replace(this.spinePatterns.hyphenatedLevels, (match, seg1, num1, seg2, num2) => {
      const digit1 = this.convertNumberWord(num1);
      const digit2 = this.convertNumberWord(num2);
      return `${seg1.toUpperCase()}${digit1}-${seg2.toUpperCase()}${digit2}`;
    });

    // Step 3: Handle "C three, C four" or "C three and C four" -> "C3-C4"
    // Also handle cross-segment transitions like "C seven T one" -> "C7-T1"
    processed = processed.replace(this.spinePatterns.consecutiveLevels, (match, seg1, num1, seg2, num2) => {
      const digit1 = this.convertNumberWord(num1);
      const digit2 = this.convertNumberWord(num2);
      
      // Check if this is a valid cross-segment transition
      const isValidTransition = this.isValidSpineTransition(seg1.toUpperCase(), digit1, seg2.toUpperCase(), digit2);
      
      if (isValidTransition) {
        return `${seg1.toUpperCase()}${digit1}-${seg2.toUpperCase()}${digit2}`;
      } else if (seg1.toUpperCase() === seg2.toUpperCase()) {
        // Same segment - check if consecutive
        const n1 = parseInt(digit1);
        const n2 = parseInt(digit2);
        if (n2 === n1 + 1) {
          return `${seg1.toUpperCase()}${digit1}-${digit2}`;
        }
      }
      // Otherwise keep them separate
      return `${seg1.toUpperCase()}${digit1}, ${seg2.toUpperCase()}${digit2}`;
    });

    // Step 4: Handle "C three four" -> "C3-C4"
    processed = processed.replace(this.spinePatterns.rangedLevels, (match, seg, num1, num2) => {
      const digit1 = this.convertNumberWord(num1);
      const digit2 = this.convertNumberWord(num2);
      return `${seg.toUpperCase()}${digit1}-${digit2}`;
    });

    // Step 5: Handle standalone "C three" -> "C3"
    processed = processed.replace(this.spinePatterns.singleLevel, (match, seg, num) => {
      const digit = this.convertNumberWord(num);
      return `${seg.toUpperCase()}${digit}`;
    });

    // Step 6: Fix spacing in "C 3" -> "C3"
    processed = processed.replace(this.spinePatterns.fixNumberSpacing, '$1$2');
    
    // Step 6.5: Handle "C3C4" -> "C3-C4"
    processed = processed.replace(this.spinePatterns.noSpaceBetween, (match, seg1, num1, seg2, num2) => {
      if (seg1.toUpperCase() === seg2.toUpperCase()) {
        const n1 = parseInt(num1);
        const n2 = parseInt(num2);
        if (n2 === n1 + 1) {
          return `${seg1.toUpperCase()}${num1}-${num2}`;
        }
      }
      return `${seg1.toUpperCase()}${num1}, ${seg2.toUpperCase()}${num2}`;
    });

    // Step 7: Ensure common medical abbreviations are uppercase
    this.upperCaseTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(regex, term);
    });

    // Step 8: Fix common patterns
    // Standardize "C3-C4" to "C3-4" (shorthand)
    processed = processed.replace(/\b([CTLS])(\d+)-([CTLS])(\d+)\b/g, (match, seg1, num1, seg2, num2) => {
      // If same segment, use shorthand
      if (seg1.toUpperCase() === seg2.toUpperCase()) {
        return `${seg1.toUpperCase()}${num1}-${num2}`;
      }
      return match;
    });
    
    // Handle remaining patterns with "five" -> "5"
    processed = processed.replace(/\b([CTLS]\d+),\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, (match, level, num) => {
      const digit = this.convertNumberWord(num);
      return `${level}, ${level[0]}${digit}`;
    });

    // Convert standalone number words to digits for measurements
    // This is for non-spine contexts like dimensions
    Object.keys(this.numberWords).forEach(word => {
      // Convert number words that appear before "by" or units
      const regex = new RegExp(`\\b${word}\\b(?=\\s+(by|millimeter|centimeter|meter|mm|cm|m)\\b)`, 'gi');
      processed = processed.replace(regex, this.numberWords[word]);
      
      // Also convert number words that appear after "by"
      const regexAfter = new RegExp(`\\b(by\\s+)${word}\\b`, 'gi');
      processed = processed.replace(regexAfter, `$1${this.numberWords[word]}`);
    });
    
    // Convert "by" between numbers to "x" for dimensions (after all number conversions)
    // e.g., "7 by 5 by 3 mm" -> "7 x 5 x 3 mm"
    // Use a while loop to replace ALL occurrences
    while (/(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/i.test(processed)) {
      processed = processed.replace(/(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/i, '$1 x $2');
    }
    
    // NOW convert metric units to abbreviations (after dimension processing)
    Object.keys(this.metricUnits).forEach(unit => {
      const abbreviation = this.metricUnits[unit];
      const regex = new RegExp(`\\b${unit}\\b`, 'gi');
      processed = processed.replace(regex, abbreviation);
    });
    
    // Final step: Apply proper capitalization
    processed = this.applyProperCapitalization(processed);
    
    // Final cleanup: ensure no double spaces (but preserve newlines)
    processed = processed.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
    
    // Smart trimming: preserve intentional line breaks
    // Check if we have trailing newlines that were explicitly added (e.g., from "new line" command)
    const hasTrailingNewlines = /\n+$/.test(processed);
    const hasLeadingNewlines = /^\n+/.test(processed);
    
    // Only trim if the result wouldn't be just whitespace/newlines
    if (processed.replace(/\s/g, '').length > 0) {
      // There's actual content
      // Trim spaces and tabs but preserve intentional newlines
      processed = processed.replace(/^[ \t]+/, ''); // Trim leading spaces/tabs only
      processed = processed.replace(/[ \t]+$/, ''); // Trim trailing spaces/tabs only
      
      // Don't trim newlines at the beginning or end - they were intentionally added
    } else {
      // The entire content is whitespace/newlines (e.g., standalone "new line" command)
      // Keep it as-is
    }
    
    return processed;
  }

  // Process text in real-time chunks (for streaming)
  processChunk(chunk) {
    // For chunks, we need to be careful not to process incomplete spine notations
    // that might be split across chunks
    return this.processText(chunk);
  }
}

module.exports = RadiologyTextProcessor;