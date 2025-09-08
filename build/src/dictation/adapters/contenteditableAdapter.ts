import { EditorAdapter } from '../insertDictation';

export class ContentEditableAdapter implements EditorAdapter {
  private element: HTMLElement;
  private onChange?: (html: string) => void;

  constructor(element: HTMLElement, onChange?: (html: string) => void) {
    this.element = element;
    this.onChange = onChange;
  }

  getSelectionRange(): { start: number; end: number } {
    // Always return end position for now - we'll handle cursor in replaceRange
    const text = this.getPlainText();
    return { start: text.length, end: text.length };
  }

  replaceRange(start: number, end: number, text: string): void {
    const selection = window.getSelection();
    
    // Check if we have a selection and it's in our editor
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Verify the selection is within our editor
      let node: Node | null = range.commonAncestorContainer;
      let isInEditor = false;
      
      while (node) {
        if (node === this.element) {
          isInEditor = true;
          break;
        }
        node = node.parentNode;
      }
      
      if (isInEditor) {
        // We have a valid selection in our editor
        // Delete any selected content first
        if (!range.collapsed) {
          range.deleteContents();
        }
        
        // Handle line breaks specially
        if (text === '\n') {
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else if (text === '\n\n') {
          const br1 = document.createElement('br');
          const br2 = document.createElement('br');
          range.insertNode(br2);
          range.insertNode(br1);
          range.setStartAfter(br2);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else if (text) {
          // Regular text insertion
          const textNode = document.createTextNode(text);
          range.insertNode(textNode);
          
          // Move cursor after inserted text
          range.setStartAfter(textNode);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        
        // Notify parent
        if (this.onChange) {
          this.onChange(this.element.innerHTML);
        }
        return;
      }
    }
    
    // No valid selection in editor - append to end
    console.log('🎯 No valid cursor position detected, appending to end');
    
    if (text === '\n') {
      this.element.appendChild(document.createElement('br'));
    } else if (text === '\n\n') {
      this.element.appendChild(document.createElement('br'));
      this.element.appendChild(document.createElement('br'));
    } else if (text) {
      // Get existing text for spacing
      const existingText = this.element.textContent || '';
      let finalText = text;
      
      // Add space if needed
      if (existingText.length > 0) {
        const lastChar = existingText[existingText.length - 1];
        if (lastChar !== ' ' && lastChar !== '\n' && /[A-Za-z0-9]/.test(text[0])) {
          finalText = ' ' + finalText;
        }
      }
      
      // Capitalize if at beginning or after sentence
      if (existingText.length === 0 || /[.!?]\s*$/.test(existingText)) {
        if (/[a-z]/.test(finalText[0])) {
          finalText = finalText[0].toUpperCase() + finalText.slice(1);
        } else if (finalText[0] === ' ' && /[a-z]/.test(finalText[1])) {
          finalText = ' ' + finalText[1].toUpperCase() + finalText.slice(2);
        }
      }
      
      const textNode = document.createTextNode(finalText);
      this.element.appendChild(textNode);
    }
    
    // Notify parent
    if (this.onChange) {
      this.onChange(this.element.innerHTML);
    }
  }

  getPlainText(): string {
    return this.element.textContent || '';
  }

  focus(): void {
    this.element.focus();
  }

  checkpoint(): void {
    // Browser handles undo/redo for contenteditable
  }
}