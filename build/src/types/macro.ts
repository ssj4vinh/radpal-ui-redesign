/**
 * Macro system types for RadPal voice commands
 */

export type MacroType = "text" | "picklist";
export type MacroScope = "global" | "findings" | "impression";

export interface Macro {
  id: string;
  userId: string;
  name: string;         // spoken name after "macro "
  type: MacroType;
  valueText?: string;   // for text macros
  options?: string[];   // for picklist macros
  scope?: MacroScope;   // optional scoping (defaults to global)
  updatedAt: string;    // ISO timestamp
  createdAt: string;    // ISO timestamp
}

export interface MacroSettings {
  enabled: boolean;
  triggerWord: string;
  fuzzyVoiceMatches: boolean;
  insertLiteralOnNotFound?: boolean; // Whether to insert literal text when macro not found
}

export const DEFAULT_MACRO_SETTINGS: MacroSettings = {
  enabled: true,
  triggerWord: "macro",
  fuzzyVoiceMatches: false,
  insertLiteralOnNotFound: false
};

export interface MacroDetectionResult {
  isMacro: boolean;
  macroName?: string;
  remainingText?: string; // Any text before the macro command
}

export interface PicklistPosition {
  x: number;
  y: number;
}