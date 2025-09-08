import { normalizeDictation, normalizeSpacingAroundInsertion } from './dictationUtils';

console.log('🧪 Testing Dictation Utilities\n');
console.log('================================\n');

// Test 1: Slash conversion
console.log('📝 Test 1: Slash token conversion');
{
  const input = 'low grade slash intermediate';
  const output = normalizeDictation(input);
  const expected = 'low grade/intermediate';
  console.log(`  Input:    "${input}"`);
  console.log(`  Output:   "${output}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${output === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 2: Don't convert "slasher"
console.log('📝 Test 2: Preserve "slasher" word');
{
  const input = 'slasher movie';
  const output = normalizeDictation(input);
  const expected = 'slasher movie';
  console.log(`  Input:    "${input}"`);
  console.log(`  Output:   "${output}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${output === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 3: Case insensitive
console.log('📝 Test 3: Case insensitive SLASH');
{
  const input = 'low SLASH high';
  const output = normalizeDictation(input);
  const expected = 'low/high';
  console.log(`  Input:    "${input}"`);
  console.log(`  Output:   "${output}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${output === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 4: Smart spacing - insert in middle
console.log('📝 Test 4: Insert with smart spacing');
{
  const original = 'Hello World';
  const insertText = 'beautiful';
  // Insert at position 6 (after "Hello ")
  const fullText = original.substring(0, 6) + insertText + original.substring(6);
  const result = normalizeSpacingAroundInsertion(fullText, insertText, 6, 6 + insertText.length);
  const expected = 'Hello beautiful World';
  console.log(`  Original: "${original}"`);
  console.log(`  Insert:   "${insertText}" at pos 6`);
  console.log(`  Output:   "${result.text}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${result.text === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 5: No space around slash
console.log('📝 Test 5: No space around slash');
{
  const fullText = 'low  high';
  const insertText = '/';
  const result = normalizeSpacingAroundInsertion(fullText, insertText, 4, 4);
  const expected = 'low/high';
  console.log(`  Original: "${fullText}"`);
  console.log(`  Insert:   "${insertText}" at pos 4`);
  console.log(`  Output:   "${result.text}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${result.text === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 6: Complex multi-part insertion
console.log('📝 Test 6: Multi-part "low grade/intermediate"');
{
  let text = 'The patient has ';
  let pos = text.length;
  
  // Insert "low grade"
  const result1 = normalizeSpacingAroundInsertion(
    text + 'low grade',
    'low grade',
    pos,
    pos + 9
  );
  text = result1.text;
  pos = result1.caretPos;
  
  // Insert "slash"
  const slashNormalized = normalizeDictation('slash');
  const result2 = normalizeSpacingAroundInsertion(
    text.substring(0, pos) + slashNormalized + text.substring(pos),
    slashNormalized,
    pos,
    pos + slashNormalized.length
  );
  text = result2.text;
  pos = result2.caretPos;
  
  // Insert "intermediate"
  const result3 = normalizeSpacingAroundInsertion(
    text.substring(0, pos) + 'intermediate' + text.substring(pos),
    'intermediate',
    pos,
    pos + 12
  );
  
  const expected = 'The patient has low grade/intermediate';
  console.log(`  Final:    "${result3.text}"`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  ${result3.text === expected ? '✅ PASS' : '❌ FAIL'}\n`);
}

// Test 7: Caret position
console.log('📝 Test 7: Caret doesn\'t jump to end');
{
  const fullText = 'Start End';
  const insertText = 'Middle';
  const result = normalizeSpacingAroundInsertion(
    'Start Middle End',
    insertText,
    6,
    12
  );
  const isCaretCorrect = result.caretPos === 12 && result.caretPos !== result.text.length;
  console.log(`  Text:     "${result.text}"`);
  console.log(`  Caret at: ${result.caretPos} (should be 12, not ${result.text.length})`);
  console.log(`  ${isCaretCorrect ? '✅ PASS' : '❌ FAIL'}\n`);
}

console.log('================================');
console.log('✨ All tests completed!\n');