# RadPal Workflow Agent Configuration

## Agent Purpose
Specialized agent for maintaining and enhancing the RadPal radiology dictation and report generation application.

## Baseline Implementation Status (Current)
**Priority**: Reliability over advanced features
- Voice dictation appends to end of text (no cursor tracking)
- Proper spacing and capitalization logic working
- Simplified implementation to avoid text disappearing/partial population issues
- Future enhancements planned: cursor position insertion, text replacement

### Voice Commands Supported
- **"delete that" / "scratch that"**: Deletes selected text or last word if nothing selected
- **"paragraph" / "new paragraph"**: Inserts double line break for new paragraph
- **"new line"**: Inserts single line break

### Number Word Conversion
- Number words automatically converted to digits (e.g., "five" → "5")
- Decimal support (e.g., "five point four" → "5.4")
- Compound numbers (e.g., "twenty-one" → "21")
- Supports: zero through ninety-nine, hundred, thousand, million

## Core Knowledge Areas

### 1. Voice Dictation Flow (Baseline Implementation)
- Voice input → Main process (electron) → `onDictationText` event
- `insertDictation` in App.tsx → `richTextEditorRef.current.insertDictation()`
- RichTextEditor component updates internal state and notifies parent via `onChange`
- State management: `findings` state → `setFindingsWithHistory`
- **Current Behavior**: Dictation always appends to end of text (cursor position tracking disabled for reliability)

### 2. Component Architecture

#### RichTextEditor Component (`src/components/RichTextEditor.tsx`)
- **Purpose**: Rich text editing with HTML support
- **Key Methods**:
  - `insertDictation(text)`: Appends voice-dictated text to end with proper spacing
    - Adds space before text if needed (unless previous char is space/newline)
    - Capitalizes at beginning or after sentence-ending punctuation (. ! ?)
    - Creates text node and appends to editor
    - NO cursor position tracking (simplified for reliability)
  - `getValue()`: Returns HTML content
  - `getPlainText()`: Returns plain text
  - `setValue(html)`: Sets HTML content
  - `saveCursor()`: No-op in baseline implementation
- **State Sync**: Uses `useEffect` to sync `value` prop with internal `editorRef`

#### App Component (`src/App.tsx`)
- **Key States**:
  - `findings`: Main content state
  - `generationResult`: Stores report/impression generation results
  - `selectedStudyType`: Current study type selection
- **Key Functions**:
  - `handleGenerate()`: Generates report with diff view
  - `handleGenerateImpression()`: Generates impression
  - `handleRichTextChange()`: Handles editor changes and triggers study suggestions

### 3. Report Generation with Diff View
```javascript
// Diff HTML structure for reports:
generationResult = {
  type: 'report',
  showDiff: true,
  diffParts: [...],  // Array of {value, added?, removed?}
  // ... other fields
}
```

- Green highlights: `<span style="background-color: rgba(58, 188, 150, 0.3); color: #3ABC96;">added text</span>`
- Red strikethrough: `<span style="background-color: rgba(227, 103, 86, 0.3); color: #E36756; text-decoration: line-through;">removed text</span>`

### 4. Common Issues & Solutions

#### Issue: Dictated text not visible
- Check: Is text in state? (console shows length > 0)
- Check: Is RichTextEditor `useEffect` syncing value prop?
- Solution: Ensure `editorRef.current.innerHTML = value` in useEffect

#### Issue: Dictation not inserting at cursor (BASELINE: Expected behavior)
- **Current Design**: Dictation always appends to end for reliability
- **Rationale**: Complex cursor tracking was causing text to disappear or insert randomly
- **Future Enhancement**: Cursor position insertion can be re-implemented once baseline is stable

#### Issue: Spacing issues with dictation
- Check: Is space being added when needed in `insertDictation`?
- Solution: Logic checks last char and adds space unless it's already space/newline

#### Issue: Diff view not showing
- Check: Is `generationResult.showDiff && generationResult.diffParts` true?
- Check: Is diff HTML being set to findings state?
- Solution: Ensure `setFindings(diffHtml)` after report generation

#### Issue: State not syncing
- Check: Is `onChange` being called in RichTextEditor?
- Check: Is `handleRichTextChange` updating state?
- Solution: Remove conditions blocking state updates

### 5. Button Functionality

#### Desktop View (line ~3180-3325)
- Copy: Copies plain text to clipboard
- Ask AI: Opens AI assistant modal
- Remove Strikeout: Keeps green highlights, removes red strikethrough
- Accept Clean: Removes all diff formatting

#### Mobile View (line ~4470-4620)
- Similar buttons with responsive styling

### 6. Key Patterns

#### Adding New Buttons
1. Add to desktop view condition check
2. Add to mobile view condition check
3. Consider if button should show for both report and impression

#### Modifying Diff Display
1. Update diff HTML generation in `handleGenerate`
2. Modify span styles for highlighting
3. Update Remove Strikeout logic if needed

### 7. Testing Workflow (Baseline)
1. Voice dictate: "Complete tear of the anterior cruciate ligament"
   - **Expected**: Text appends to end with proper spacing
   - **Note**: Will NOT insert at cursor position in baseline
2. Select study type: MRI Knee
3. Generate report → Should show diff with green/red
4. Generate impression → Should show impression text
5. Test buttons: Copy, Ask AI, Remove Strikeout (report only)
6. Test capitalization:
   - Dictate at beginning → Should capitalize
   - Dictate after period → Should capitalize
   - Dictate mid-sentence → Should not capitalize

## Agent Capabilities
- Debug voice dictation visibility issues
- Fix state synchronization problems
- Add/modify UI buttons and actions
- Enhance diff view rendering
- Troubleshoot report/impression generation
- Optimize component performance
- **Baseline Note**: Currently prioritizing reliability over advanced features (cursor position tracking)

## File Structure
```
src/
├── App.tsx                 # Main application logic
├── components/
│   ├── RichTextEditor.tsx  # Rich text editor component
│   └── RichTextEditor.css  # Editor styles
├── utils/
│   └── dictationUtils.ts   # Voice dictation utilities
└── agent/
    ├── generateReport.ts    # Report generation logic
    └── generateImpression.ts # Impression generation logic
```

## Baseline insertDictation Implementation
```javascript
insertDictation: (text: string) => {
  const trimmedText = text.trim().toLowerCase()
  
  // Handle voice commands
  if (trimmedText === 'delete that' || trimmedText === 'scratch that') {
    // Delete selected text or last word
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      selection.getRangeAt(0).deleteContents()
    } else {
      // Delete last word if no selection
      const words = editorRef.current.textContent.trim().split(/\s+/)
      words.pop()
      editorRef.current.textContent = words.join(' ')
    }
    onChange(editorRef.current.innerHTML)
    return
  }
  
  if (trimmedText === 'paragraph' || trimmedText === 'new paragraph') {
    editorRef.current.appendChild(document.createElement('br'))
    editorRef.current.appendChild(document.createElement('br'))
    onChange(editorRef.current.innerHTML)
    return
  }
  
  if (trimmedText === 'new line') {
    editorRef.current.appendChild(document.createElement('br'))
    onChange(editorRef.current.innerHTML)
    return
  }
  
  // Convert number words to digits
  let processedText = convertNumberWords(text.trim())
  const existingText = editorRef.current.textContent || ''
  
  // Add spacing and capitalization
  if (existingText.length > 0 && !lastChar.match(/[\s\n]/)) {
    processedText = ' ' + processedText
  }
  
  if (existingText.length === 0 || /[.!?]\s*$/.test(existingText)) {
    processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1)
  }
  
  editorRef.current.appendChild(document.createTextNode(processedText))
  onChange(editorRef.current.innerHTML)
}
```

## Common Commands
```bash
# Build application
npm run build

# Test in development
npm run dev

# Check for TypeScript errors
npx tsc --noEmit
```