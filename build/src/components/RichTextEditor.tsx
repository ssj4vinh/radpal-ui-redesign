import React, { useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from 'react'

export interface RichTextEditorHandle {
  insertDictation: (text: string) => void
  getValue: () => string
  getPlainText: () => string
  setValue: (html: string) => void
  focus: () => void
  getElement: () => HTMLDivElement | null
  saveCursor: () => void
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  className?: string
}

// Helper types and functions defined at module level to avoid initialization issues
type FlatPiece =
  | { kind: 'text'; node: Text; start: number; end: number }
  | { kind: 'br'; el: HTMLBRElement; index: number };

function flattenEditor(el: HTMLElement): { flat: string; pieces: FlatPiece[] } {
  let flat = '';
  const pieces: FlatPiece[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL, null);

  let n: Node | null = walker.currentNode;
  n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n as Text;
      const start = flat.length;
      const text = t.nodeValue ?? '';
      flat += text;
      const end = flat.length;
      pieces.push({ kind: 'text', node: t, start, end });
    } else if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR') {
      pieces.push({ kind: 'br', el: n as HTMLBRElement, index: flat.length });
      flat += '\n';
    }
    n = walker.nextNode();
  }
  return { flat, pieces };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function getFlatOffsetsFromRange(el: HTMLElement, r: Range) {
  const { flat, pieces } = flattenEditor(el);

  const posFor = (container: Node, offset: number): number => {
    if (container.nodeType === Node.TEXT_NODE) {
      const piece = pieces.find(p => p.kind === 'text' && p.node === container);
      if (!piece) return flat.length;
      return (piece as Extract<FlatPiece, {kind:'text'}>).start + offset;
    }
    let abs = 0;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (p.kind === 'text') {
        if (p.node.parentNode === container) {
          let idx = 0;
          for (let c = container.firstChild; c; c = c.nextSibling) {
            if (c === p.node) break;
            idx++;
          }
          if (idx >= offset) return abs;
        }
        abs = (p as any).end;
      } else {
        if (p.el.parentNode === container) {
          let idx = 0;
          for (let c = container.firstChild; c; c = c.nextSibling) {
            if (c === p.el) break;
            idx++;
          }
          if (idx >= offset) return abs;
        }
        abs = p.index + 1;
      }
    }
    return flat.length;
  };

  const start = posFor(r.startContainer, r.startOffset);
  const end = posFor(r.endContainer, r.endOffset);
  return { start: clamp(start, 0, flat.length), end: clamp(end, 0, flat.length) };
}

function makeRangeFromFlatOffsets(el: HTMLElement, start: number, end: number): Range | null {
  const { flat, pieces } = flattenEditor(el);
  const S = clamp(start, 0, flat.length);
  const E = clamp(end, 0, flat.length);

  const locate = (abs: number): { node: Node; offset: number } => {
    for (const p of pieces) {
      if (p.kind === 'text') {
        if (abs <= p.end) {
          const off = clamp(abs - p.start, 0, (p.node.nodeValue ?? '').length);
          return { node: p.node, offset: off };
        }
      } else {
        if (abs <= p.index) {
          const parent = p.el.parentNode!;
          let idx = 0, c = parent.firstChild;
          for (; c; c = c.nextSibling, idx++) { if (c === p.el) break; }
          return { node: parent, offset: idx };
        }
      }
    }
    return { node: el, offset: el.childNodes.length };
  };

  const a = locate(S);
  const b = locate(E);

  const r = document.createRange();
  try {
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
  } catch {
    return null;
  }
  return r;
}

// Helper functions for word boundaries and spacing
function isWordChar(ch: string) {
  return /[A-Za-z0-9_'''\-]/.test(ch);
}

function expandRangeToWordBoundaries(editor: HTMLElement, range: Range): Range {
  const full = document.createRange();
  full.selectNodeContents(editor);

  // Compute plain text positions of start and end
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.startContainer, range.startOffset);
  const startIdx = pre.toString().length;

  const preEnd = document.createRange();
  preEnd.selectNodeContents(editor);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const endIdx = preEnd.toString().length;

  const fullText = editor.innerText ?? editor.textContent ?? "";
  let L = startIdx, R = endIdx;

  while (L > 0 && isWordChar(fullText[L - 1])) L--;
  while (R < fullText.length && isWordChar(fullText[R])) R++;

  // Map plain offsets back into DOM positions
  function setPointAtPlainOffset(r: Range, which: "start" | "end", plainOffset: number) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    let acc = 0;
    let node = walker.nextNode() as Text | null;
    while (node) {
      const len = node.nodeValue?.length ?? 0;
      if (acc + len >= plainOffset) {
        const off = Math.max(0, plainOffset - acc);
        which === "start" ? r.setStart(node, off) : r.setEnd(node, off);
        return;
      }
      acc += len;
      node = walker.nextNode() as Text | null;
    }
    // fallback: end of editor
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    which === "start" ? r.setStart(endRange.endContainer, (endRange.endOffset as number) ?? 0)
                      : r.setEnd(endRange.endContainer, (endRange.endOffset as number) ?? 0);
  }

  const out = document.createRange();
  out.selectNodeContents(editor);
  setPointAtPlainOffset(out, "start", L);
  setPointAtPlainOffset(out, "end", R);
  return out;
}

function smartSpacing(leftCtx: string, insert: string, rightCtx: string) {
  let txt = insert;

  // internal punctuation spacing: "word , word" -> "word, word"
  txt = txt.replace(/\s+([,.;:!?%)])/g, "$1").replace(/\(\s+/g, "(");

  const leftCh = leftCtx.slice(-1);
  const firstCh = txt[0];
  const rightCh = rightCtx[0] ?? "";

  const isWordStart = (c?: string) => !!c && /[A-Za-z0-9]/.test(c);

  // add left space if both sides are wordy (except if starting with joiner)
  if (isWordStart(leftCh) && isWordStart(firstCh) && firstCh !== "/" && firstCh !== "-") {
    txt = " " + txt;
  }
  // trim trailing space before right punctuation
  if (txt.endsWith(" ") && /[),.;:!?%]/.test(rightCh)) {
    txt = txt.slice(0, -1);
  }
  return txt;
}

// Marker helpers
const ZW = "\u200B"; // zero-width space to ensure markers live in text flow

function makeMarker(id: string) {
  const span = document.createElement("span");
  span.setAttribute("data-radpal-marker", id);
  span.style.display = "inline";
  span.style.lineHeight = "0";
  span.textContent = ZW; // keep it selectable
  return span;
}

function findMarker(editor: HTMLElement, id: string): Node | null {
  return editor.querySelector(`[data-radpal-marker="${id}"]`);
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, placeholder, style, className }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const isInternalChange = useRef(false)
    const lastValue = useRef<string>('')
    const pendingExternalHtml = useRef<string | null>(null)

    // Convert number words to digits
    const convertNumberWords = useCallback((text: string): string => {
      const numberWords: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
        'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
      }
      
      let processed = text
      
      // Handle decimal numbers (e.g., "five point four" -> "5.4")
      processed = processed.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+point\s+(zero|one|two|three|four|five|six|seven|eight|nine)/gi, 
        (match, whole, decimal) => {
          return (numberWords[whole.toLowerCase()] || whole) + '.' + (numberWords[decimal.toLowerCase()] || decimal)
        }
      )
      
      // Handle compound numbers (e.g., "twenty-one" -> "21")
      processed = processed.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/gi,
        (match, tens, ones) => {
          const tensNum = parseInt(numberWords[tens.toLowerCase()] || '0')
          const onesNum = parseInt(numberWords[ones.toLowerCase()] || '0')
          return (tensNum + onesNum).toString()
        }
      )
      
      // Replace standalone number words
      for (const [word, digit] of Object.entries(numberWords)) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        processed = processed.replace(regex, digit)
      }
      
      return processed
    }, [])

    // Format text with basic HTML
    const formatText = useCallback((text: string) => {
      if (!text) return ''
      return text.replace(/\n/g, '<br>')
    }, [])

    // Save cursor position before any dictation
    const savedSelection = useRef<{ start: number, end: number } | null>(null)
    const savedOffsets = useRef<{ start: number; end: number } | null>(null)
    const lastKnownRange = useRef<Range | null>(null)
    const cursorSaveInterval = useRef<NodeJS.Timeout | null>(null)
    
    // Flush any pending external HTML updates after internal changes
    const flushPendingExternal = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      if (pendingExternalHtml.current != null) {
        const next = pendingExternalHtml.current;
        pendingExternalHtml.current = null;
        console.log('🔄 Flushing pending external HTML:', next.slice(0, 100));
        if (el.innerHTML !== next) {
          el.innerHTML = next;
          lastValue.current = next;
          // Optional: place caret at end for full replacements
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
      }
    }, [])
    
    // Explicit save cursor for compatibility (when called from App.tsx)
    const saveCursorPosition = useCallback(() => {
      captureSelectionIfInEditor();
    }, [captureSelectionIfInEditor])

    // Handle input changes
    const handleInput = useCallback(() => {
      if (editorRef.current && !isInternalChange.current) {
        const html = editorRef.current.innerHTML
        lastValue.current = html
        onChange(html)
      }
    }, [onChange])

    // Handle paste to maintain formatting
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      
      // Don't lose focus/selection
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        
        // Trigger input event
        if (editorRef.current) {
          const html = editorRef.current.innerHTML
          lastValue.current = html
          onChange(html)
        }
      }
    }, [onChange])

    // Initialize editor with initial value
    useEffect(() => {
      if (editorRef.current && !lastValue.current) {
        const initialValue = value || ''
        editorRef.current.innerHTML = initialValue
        lastValue.current = initialValue
      }
    }, [value])
    
    // Update editor content when value prop changes
    // Buffer external updates if we're in the middle of an internal edit
    useEffect(() => {
      const el = editorRef.current
      if (!el) return
      const next = value ?? ''
      
      if (isInternalChange.current) {
        // We're in the middle of an internal DOM edit (dictation). Remember this external update.
        pendingExternalHtml.current = next
        console.log('📦 Buffering external update during internal change')
        return
      }
      
      // Apply the update if it's different from current content
      if (el.innerHTML !== next) {
        console.log('📝 Syncing value to editor')
        el.innerHTML = next
        lastValue.current = next
      }
    }, [value])
    
    // Reliable selection capture that only records when selection is truly inside our editor
    const captureSelectionIfInEditor = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;

      // Do NOT overwrite while we're doing our own DOM edit; we'll set savedOffsets manually then
      if (isInternalChange.current) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);

      // Only capture if the live selection is actually in our editor
      if (!el.contains(r.commonAncestorContainer)) return;

      try {
        // Use flat model helpers
        const next = getFlatOffsetsFromRange(el, r);
        savedOffsets.current = next;
        lastKnownRange.current = r.cloneRange();
        savedSelection.current = next; // Keep for compatibility
        // console.log('💾 captured selection (global)', next);
      } catch (e) {
        console.error('Error capturing selection:', e);
      }
    }, [])
    
    // Install the global listener once
    useEffect(() => {
      const handler = () => captureSelectionIfInEditor();
      document.addEventListener('selectionchange', handler, { passive: true });
      return () => document.removeEventListener('selectionchange', handler);
    }, [captureSelectionIfInEditor])
    

    const restoreCursorPosition = useCallback(() => {
      const editor = editorRef.current
      if (!editor || !savedSelection.current) return
      
      const { start, end } = savedSelection.current
      const text = editor.textContent || ''
      
      // Create a tree walker to find text nodes
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      let currentPos = 0
      let startNode: Node | null = null
      let startOffset = 0
      let endNode: Node | null = null
      let endOffset = 0
      
      while (walker.nextNode()) {
        const node = walker.currentNode
        const nodeLength = node.textContent?.length || 0
        
        if (!startNode && currentPos + nodeLength >= start) {
          startNode = node
          startOffset = start - currentPos
        }
        
        if (!endNode && currentPos + nodeLength >= end) {
          endNode = node
          endOffset = end - currentPos
        }
        
        if (startNode && endNode) break
        currentPos += nodeLength
      }
      
      if (startNode) {
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()
          range.setStart(startNode, Math.min(startOffset, startNode.textContent?.length || 0))
          
          if (endNode) {
            range.setEnd(endNode, Math.min(endOffset, endNode.textContent?.length || 0))
          } else {
            range.collapse(true)
          }
          
          selection.removeAllRanges()
          selection.addRange(range)
          console.log('✅ Restored cursor position')
        }
      }
    }, [])
    
    // ===== Main API: insert at caret or replace selection via markers =====
    const insertDictationUsingMarkers = useCallback(async (raw: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      
      console.log('🎯 Starting marker-based insertion for:', raw);

      // BLOCK external value->DOM syncing while we mutate DOM
      isInternalChange.current = true;

      // Always ensure editor has focus at the moment of insertion
      editor.focus({ preventScroll: true } as any);
      
      // Small delay to ensure focus is established
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Debug: log current state
      console.log('🔍 Pre-insertion state:', { 
        liveSelInEditor: !!(window.getSelection()?.rangeCount && editor?.contains(window.getSelection()!.getRangeAt(0).commonAncestorContainer)),
        savedOffsets: savedOffsets.current,
        lastKnownRange: !!lastKnownRange.current,
        editorHasContent: !!editor.textContent,
        editorText: (editor.textContent || '').slice(0, 50)
      });

      // 1) Get current selection; if it's not in our editor, try to restore saved position
      let sel = window.getSelection();
      let range: Range | null = null;

      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        if (editor.contains(r.commonAncestorContainer)) {
          range = r.cloneRange();
          console.log('✅ Using existing selection in editor');
        }
      }
      
      // NEW: restore from savedOffsets if live selection missing/foreign
      if (!range && savedOffsets.current) {
        const { start, end } = savedOffsets.current;
        range = makeRangeFromFlatOffsets(editor, start, end);
        if (range) {
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(range);
          console.log('✅ Restored from savedOffsets', savedOffsets.current);
        }
      }
      
      // LAST RESORT only - append to end
      if (!range) {
        console.log('⚠️ No selection to restore — falling back to end');
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(range);
      }

      // 2) If selection not collapsed, expand to word boundaries
      if (!range.collapsed) {
        range = expandRangeToWordBoundaries(editor, range);
      }

      // 3) Drop markers for start and end (if collapsed, both after each other)
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const START = `radpal-start-${id}`;
      const END = `radpal-end-${id}`;

      const startMarker = makeMarker(START);
      range.insertNode(startMarker);
      // After inserting start, the live range end may have shifted; re-select end:
      sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      let endMarker: HTMLElement | null = null;
      if (!range.collapsed) {
        // Recompute (in case DOM shifted) then insert END
        const endRange = range.cloneRange();
        endRange.collapse(false);
        endMarker = makeMarker(END);
        endRange.insertNode(endMarker);
      }

      // 4) Compute left/right text contexts based on markers
      const before = document.createRange();
      before.selectNodeContents(editor);
      before.setEnd(startMarker, 0);
      const leftCtx = before.toString();

      const after = document.createRange();
      after.selectNodeContents(editor);
      after.setStartAfter(endMarker ?? startMarker); // Fixed: use setStartAfter for element
      const rightCtx = after.toString();
      
      console.log('📍 Insertion context:', {
        leftCtx: leftCtx.slice(-20),
        rightCtx: rightCtx.slice(0, 20),
        hasEndMarker: !!endMarker
      });

      // 5) Normalize/spacing - handle line breaks specially
      let insertText = raw.trim();
      
      // Handle line breaks
      if (insertText === 'new line') {
        insertText = '\n';
      } else if (insertText === 'paragraph' || insertText === 'new paragraph') {
        insertText = '\n\n';
      } else {
        // Apply smart spacing for regular text
        insertText = smartSpacing(leftCtx, insertText, rightCtx);
      }

      // 6) Delete the selected content between markers (if any)
      const replaceRange = document.createRange();
      replaceRange.setStartAfter(startMarker);
      if (endMarker) replaceRange.setEndBefore(endMarker);
      else replaceRange.setEndAfter(startMarker); // collapsed: nothing selected
      replaceRange.deleteContents();

      // Ensure there's a real insertion point after START
      const caretRange = document.createRange();
      caretRange.setStartAfter(startMarker);
      caretRange.collapse(true);

      // 7) Insert text node or line breaks
      let insertedNode: Node;
      try {
        if (insertText === '\n' || insertText === '\n\n') {
          const brs = insertText === '\n\n' ? [document.createElement('br'), document.createElement('br')] : [document.createElement('br')];
          brs.forEach(br => caretRange.insertNode(br));
          insertedNode = brs[brs.length - 1];
        } else {
          const node = document.createTextNode(insertText);
          caretRange.insertNode(node);
          insertedNode = node;
        }
        
        console.log('✅ Text inserted successfully');
        
        // 8) Remove markers and place caret after inserted node
        startMarker.remove();
        endMarker?.remove();

        const newCaret = document.createRange();
        newCaret.setStartAfter(insertedNode);
        newCaret.collapse(true);

        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(newCaret);
        
        // Persist for next chunk using same flat model
        savedOffsets.current = getFlatOffsetsFromRange(editor, newCaret);
        lastKnownRange.current = newCaret.cloneRange();
        savedSelection.current = savedOffsets.current; // Keep for compatibility
        console.log('💾 Updated position after insertion:', savedOffsets.current);
      } catch (error) {
        console.error('❌ Error during marker insertion:', error);
        // Fallback: clean up markers and append to end
        startMarker?.remove();
        endMarker?.remove();
        
        const textNode = document.createTextNode(insertText);
        editor.appendChild(textNode);
        console.log('⚠️ Used fallback append to end');
      }

      // 9) Update state without losing caret (defer + guard)
      const html = editor.innerHTML;
      lastValue.current = html;
      console.log('📝 New HTML:', html);
      
      // Defer state update so React won't clobber the caret
      requestAnimationFrame(() => {
        onChange(html);
        // After React sees our change, clear the guard and apply any buffered external set
        setTimeout(() => {
          isInternalChange.current = false;
          flushPendingExternal();  // Apply any GPT/programmatic "Generate" text that arrived meanwhile
        }, 0);
      });
    }, [onChange, flushPendingExternal])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertDictation: (text: string) => {
        console.log('🎤 RichTextEditor.insertDictation called with:', text)
        if (!editorRef.current) {
          console.error('🎤 RichTextEditor: editorRef.current is null!')
          return
        }
        
        const trimmedText = text.trim().toLowerCase()
        
        // Handle special voice commands
        if (trimmedText === 'delete that' || trimmedText === 'scratch that') {
          if (document.activeElement !== editorRef.current) {
            editorRef.current.focus()
          }
          
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            if (!range.collapsed) {
              range.deleteContents()
            } else {
              // Delete last word
              const content = editorRef.current.textContent || ''
              const lastSpaceIndex = content.lastIndexOf(' ')
              if (lastSpaceIndex > 0) {
                editorRef.current.textContent = content.substring(0, lastSpaceIndex)
              } else {
                editorRef.current.textContent = ''
              }
            }
            
            isInternalChange.current = true
            const newHtml = editorRef.current.innerHTML
            lastValue.current = newHtml
            onChange(newHtml)
            setTimeout(() => { 
              isInternalChange.current = false
              flushPendingExternal()
            }, 10)
          }
          return
        }
        
        // Convert number words to digits
        let processedText = convertNumberWords(text.trim())
        
        // Capitalize if at beginning or after sentence
        const editor = editorRef.current
        const existingText = editor.textContent || ''
        
        if (existingText.length === 0 || /[.!?]\s*$/.test(existingText)) {
          if (processedText.length > 0 && /[a-z]/.test(processedText[0])) {
            processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1)
          }
        }
        
        // Use the new marker-based insertion
        insertDictationUsingMarkers(processedText)
        
        console.log('🎤 Dictation inserted')
      },
      getValue: () => {
        const value = editorRef.current?.innerHTML || lastValue.current || ''
        console.log('🔍 getValue called, returning:', { value, length: value.length })
        return value
      },
      getPlainText: () => {
        const text = editorRef.current?.innerText || ''
        console.log('🔍 getPlainText called, returning:', { text, length: text.length })
        return text
      },
      setValue: (html: string) => {
        if (editorRef.current) {
          isInternalChange.current = true
          const formatted = formatText(html)
          editorRef.current.innerHTML = formatted
          lastValue.current = formatted
          onChange(formatted)
          setTimeout(() => {
            isInternalChange.current = false
          }, 100)
        }
      },
      focus: () => editorRef.current?.focus(),
      getElement: () => editorRef.current,
      saveCursor: saveCursorPosition
    }), [onChange, formatText, convertNumberWords, insertDictationUsingMarkers, captureSelectionIfInEditor, flushPendingExternal])

    return (
      <div
        className={className}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          padding: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          ...style
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: '100%',
            outline: 'none',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#e0e0e0',
            backgroundColor: 'transparent',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowY: 'auto'
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
    )
  }
)

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor