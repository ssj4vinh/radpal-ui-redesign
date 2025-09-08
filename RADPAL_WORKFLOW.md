# RadPal Workflow Documentation

## Overview
RadPal is an Electron-based radiology dictation application that integrates voice dictation with AI-powered report generation. The app features a rich text editor with diff view capabilities for comparing template and generated reports.

## Core Workflow

### 1. Voice Dictation Flow
```
User speaks → Microphone → Electron Main Process → Renderer Process → RichTextEditor
```

1. **Audio Capture**: Web Audio API captures audio via ScriptProcessorNode
2. **Transcription**: Deepgram processes audio in main process
3. **Text Delivery**: Main process sends text via IPC to renderer
4. **Insertion**: `insertDictation()` adds text to RichTextEditor
5. **State Update**: Editor notifies parent via `onChange` callback

### 2. Report Generation Flow
```
Findings → AI Agent → Diff Comparison → HTML with Highlights → RichTextEditor Display
```

1. **Input**: User's dictated findings
2. **Study Type**: Auto-suggested or manually selected
3. **Generation**: AI generates report based on template
4. **Diff Calculation**: Compare template vs generated text
5. **Display**: Show diff in RichTextEditor with green/red highlights

### 3. State Management

#### Key State Variables
- `findings`: Current editor content (HTML string)
- `generationResult`: Stores generation results and diff data
- `selectedStudyType`: Current study type (e.g., "MRI Knee")

#### State Flow
```javascript
Voice Input → insertDictation() → onChange() → setFindings() → findings state
                                                     ↓
                                            Study Type Suggestion
                                                     ↓
                                            Generate Report/Impression
                                                     ↓
                                            Update findings with diff HTML
```

## Component Details

### RichTextEditor Component

**Purpose**: Provides rich text editing with HTML support and diff display

**Key Features**:
- ContentEditable div for text input
- HTML content preservation
- Voice dictation insertion
- Diff highlight rendering

**Important Methods**:
```javascript
insertDictation(text: string)  // Insert voice-dictated text
getValue(): string             // Get HTML content
getPlainText(): string        // Get plain text
setValue(html: string)        // Set HTML content
```

### App Component Integration

**Dictation Handling**:
```javascript
// Receives dictation from Electron
window.electronAPI.onDictationText((text) => {
  insertDictation(text)
})

// Insert into editor
const insertDictation = (text) => {
  richTextEditorRef.current.insertDictation(text)
  // Force state update if needed
  setFindingsWithHistory(richTextEditorRef.current.getValue(), true)
}
```

**Report Generation**:
```javascript
const handleGenerate = async () => {
  // 1. Get findings (from state or editor)
  let currentFindings = findings || richTextEditorRef.current.getValue()
  
  // 2. Generate report with AI
  const result = await generateReportWithAgent(...)
  
  // 3. Calculate diff
  const diffParts = diffWordsWithSpace(template, generated)
  
  // 4. Build HTML with highlights
  let diffHtml = buildDiffHtml(diffParts)
  
  // 5. Update editor
  richTextEditorRef.current.setValue(diffHtml)
  setFindings(diffHtml)
}
```

## Diff View Implementation

### HTML Structure for Diff
```html
<!-- Added text (green) -->
<span style="background-color: rgba(58, 188, 150, 0.3); 
             color: #3ABC96; 
             padding: 1px 2px; 
             border-radius: 2px;">
  added text
</span>

<!-- Removed text (red strikethrough) -->
<span style="background-color: rgba(227, 103, 86, 0.3); 
             color: #E36756; 
             text-decoration: line-through; 
             padding: 1px 2px; 
             border-radius: 2px;">
  removed text
</span>
```

### Button Actions

**Remove Strikeout**: Removes red strikethrough text, keeps green highlights
```javascript
// Filter out removed parts, keep added parts with highlighting
diffParts.filter(part => !part.removed).forEach(part => {
  if (part.added) {
    // Keep green highlight
    diffHtml += `<span style="...green...">...</span>`
  } else {
    // Normal text
    diffHtml += part.value
  }
})
```

**Accept Clean**: Removes all diff formatting
```javascript
// Extract only text without any formatting
const cleanText = diffParts
  .filter(part => !part.removed)
  .map(part => part.value)
  .join('')
```

## Common Issues & Solutions

### Issue 1: Dictated Text Not Visible
**Symptoms**: Text is in state but not showing in editor
**Solution**: Check RichTextEditor's useEffect for value syncing
```javascript
useEffect(() => {
  if (value !== editorRef.current.innerHTML) {
    editorRef.current.innerHTML = value || ''
  }
}, [value])
```

### Issue 2: Diff View Not Rendering
**Symptoms**: Report generates but no diff highlights
**Solution**: Ensure diff HTML is set to findings state
```javascript
if (diffHtml) {
  richTextEditorRef.current.setValue(diffHtml)
  setFindings(diffHtml)  // Critical: Update state
}
```

### Issue 3: State Synchronization
**Symptoms**: Changes in editor not reflected in state
**Solution**: Ensure onChange is properly wired
```javascript
<RichTextEditor
  value={findings}
  onChange={handleRichTextChange}  // Must update findings state
/>
```

## Development Tips

### Adding New Features
1. **New Button**: Add to both desktop and mobile views
2. **State Changes**: Always update via setFindings()
3. **Diff Modifications**: Update both generation and button handlers

### Debugging
- Check console for state changes: "📊 FINDINGS STATE CHANGED"
- Verify HTML content: "🎤 RichTextEditor: After insertion"
- Monitor diff generation: "🔍 DIFF DEBUG"

### Performance Considerations
- Debounce study type suggestions
- Use useCallback for event handlers
- Minimize re-renders with proper dependencies

## File Locations
- Main app logic: `src/App.tsx`
- Editor component: `src/components/RichTextEditor.tsx`
- Dictation utils: `src/utils/dictationUtils.ts`
- Report generation: `src/agent/generateReport.ts`
- Impression generation: `src/agent/generateImpression.ts`