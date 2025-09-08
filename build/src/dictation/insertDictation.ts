export type EditorAdapter = {
  getSelectionRange(): { start: number; end: number };
  replaceRange(start: number, end: number, text: string): void;
  getPlainText(): string;
  focus(): void;
  checkpoint?(): void;
};

export type DictationOptions = {
  rawTranscript: string;
  trimFinal?: boolean;
  customWordReplacements?: Array<[string, string]>;
};

import { 
  normalizeTranscript, 
  applySmartSpacing
} from './normalization';

export function insertDictationAtSelection(
  adapter: EditorAdapter, 
  opts: DictationOptions
): void {
  // Start checkpoint for undo grouping if available
  if (adapter.checkpoint) {
    adapter.checkpoint();
  }
  
  // Handle special commands that are already processed in RichTextEditor
  const command = opts.rawTranscript.trim().toLowerCase();
  if (command === 'delete that' || command === 'scratch that' ||
      command === 'paragraph' || command === 'new paragraph' ||
      command === 'new line') {
    // These are handled in RichTextEditor directly
    return;
  }

  // Normalize the transcript (number conversion, word replacements)
  const normalizedText = normalizeTranscript(
    opts.rawTranscript, 
    opts.customWordReplacements
  );

  if (!normalizedText) {
    adapter.focus();
    return;
  }

  // Simply pass the normalized text to the adapter
  // The adapter handles cursor position and spacing
  adapter.replaceRange(0, 0, normalizedText);

  // Focus the editor
  adapter.focus();
}