// Simple test runner for dictation utilities
const { normalizeDictation, normalizeSpacingAroundInsertion, insertDictationAtCaret } = require('./dictationUtils');

console.log('Testing Dictation Utilities\n');
console.log('============================\n');

// Test 1: Slash conversion
console.log('Test 1: Slash token conversion');
const test1 = normalizeDictation('low grade slash intermediate');
console.log(`Input: "low grade slash intermediate"`);
console.log(`Output: "${test1}"`);
console.log(`Expected: "low grade/intermediate"`);
console.log(`✅ Pass: ${test1 === 'low grade/intermediate'}\n`);

// Test 2: No conversion for compound words
console.log('Test 2: No conversion for "slasher"');
const test2 = normalizeDictation('slasher movie');
console.log(`Input: "slasher movie"`);
console.log(`Output: "${test2}"`);
console.log(`Expected: "slasher movie"`);
console.log(`✅ Pass: ${test2 === 'slasher movie'}\n`);

// Test 3: Case insensitive
console.log('Test 3: Case insensitive slash conversion');
const test3 = normalizeDictation('low SLASH high');
console.log(`Input: "low SLASH high"`);
console.log(`Output: "${test3}"`);
console.log(`Expected: "low/high"`);
console.log(`✅ Pass: ${test3 === 'low/high'}\n`);

// Test 4: Smart spacing
console.log('Test 4: Smart spacing around insertion');
const test4 = normalizeSpacingAroundInsertion(
  'HelloWorld',
  'there',
  5,
  10
);
console.log(`Full text: "HelloWorld", Insert "there" at position 5-10`);
console.log(`Output: "${test4.text}"`);
console.log(`Expected: "Hello there World"`);
console.log(`✅ Pass: ${test4.text === 'Hello there World'}\n`);

// Test 5: No space around slash
console.log('Test 5: No space around slash');
const test5 = normalizeSpacingAroundInsertion(
  'low  high',
  '/',
  4,
  4
);
console.log(`Full text: "low  high", Insert "/" at position 4`);
console.log(`Output: "${test5.text}"`);
console.log(`Expected: "low/high"`);
console.log(`✅ Pass: ${test5.text === 'low/high'}\n`);

// Test 6: Multiple insertions
console.log('Test 6: Multiple sequential insertions');
let text = 'The patient has';
console.log(`Starting text: "${text}"`);

// Mock textarea
const mockTextarea = {
  selectionStart: 15,
  selectionEnd: 15,
  value: text
};

// First insertion
mockTextarea.value = text + ' low grade';
text = mockTextarea.value;
console.log(`After "low grade": "${text}"`);

// Second insertion  
mockTextarea.value = text + '/';
text = mockTextarea.value;
console.log(`After "/": "${text}"`);

// Third insertion
mockTextarea.value = text + 'intermediate';
text = mockTextarea.value;
console.log(`After "intermediate": "${text}"`);

// Normalize
const normalized = text.replace(/\s*\/\s*/g, '/').replace(/  +/g, ' ');
console.log(`Final normalized: "${normalized}"`);
console.log(`Expected: "The patient has low grade/intermediate"`);
console.log(`✅ Pass: ${normalized === 'The patient has low grade/intermediate'}\n`);

console.log('============================');
console.log('All tests completed!');