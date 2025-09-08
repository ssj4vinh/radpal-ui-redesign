declare global {
  interface Window {
    electron?: {
      closeWindow: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      setUser: (user: any) => void;
      getUser: () => any;
      openOutputWindow: (content: string) => void;
      openDiffWindow: (template: string, result: string) => void;
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
      };
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
    electronAPI?: {
      gptRequest: (prompt: string, text: string) => Promise<string>;
      sendAutofill: (key: string, text: string) => void;
      getClipboard: () => string;
      setClipboard: (content: string) => void;
      hideWindow: () => void;
      showWindow: () => void;
      onWindowFocused: (callback: (focused: boolean) => void) => void;
      onWindowFocus: (callback: (focused: boolean) => void) => void;
      onGptData: (callback: (data: any) => void) => void;
      onPopupContent: (callback: (data: any) => void) => void;
      onSessionData: (callback: (session: any) => void) => void;
      onUserData: (callback: (user: any) => void) => void;
      onAutofillReceived: (callback: (event: any, autofillKey: string) => void) => void;
      getFindings: () => Promise<string>;
      setFindings: (findings: string) => void;
      resetWindowSize: () => void;
      generateReport: (prompt: string) => Promise<string>;
      readPrompt: (name: string) => Promise<string>;
      saveTextboxSize?: (key: string, size: number) => Promise<void>;
      getTextboxSize?: (key: string) => Promise<number | null>;
      setApiProvider?: (provider: 'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi' | 'gpt-5' | 'mistral-local') => Promise<string>;
      getApiProvider?: () => Promise<'openai' | 'claude-sonnet' | 'claude-opus' | 'claude-opus-4.1' | 'gemini' | 'kimi' | 'gpt-5' | 'mistral-local'>;
      
      // Window control methods
      contractWindow?: () => void;
      minimizePopup?: () => void;
      closePopup?: () => void;
      closeApp?: () => void;
      closeAppGentle?: () => void;
      expandWindow?: () => void;
      resizeForLoginMode?: () => void;
      resizeForMainMode?: () => void;
      
      // llama.cpp server methods
      onLlamaServerStatus?: (callback: (status: { running: boolean; error?: string; external?: boolean }) => void) => () => void;
      onModelDownloadStatus?: (callback: (status: any) => void) => () => void;
      getLlamaServerStatus?: () => Promise<{ running: boolean; process: boolean; ready: boolean }>;
      restartLlamaServer?: () => Promise<boolean>;
      
      // Authentication methods
      authSignIn: (email: string, password: string) => Promise<any>;
      authSignUp: (email: string, password: string) => Promise<any>;
      authSignOut: () => Promise<any>;
      authGetSession: () => Promise<any>;
      authGetUser: () => Promise<any>;
      authSetupListener: () => Promise<any>;
      onAuthStateChange: (callback: (data: { event: string; session: any }) => void) => () => void;
      setCurrentUser: (user: any) => Promise<any>;
      setSupabaseSession: (session: any) => Promise<any>;
      getCurrentUser: () => Promise<any>;
      getSupabaseSession: () => Promise<any>;
      
      // Agent logic inheritance methods
      getLogicLayers?: (userId: string, studyType: string) => Promise<any>;
      updateBaseLogic?: (userId: string, baseLogic: any) => Promise<any>;
      updateStudyLogic?: (userId: string, studyType: string, studyLogic: any) => Promise<any>;
      
      // User profile methods
      'fetch-user-profile'?: (userId: string) => Promise<any>;
      'update-user-profile'?: (userId: string, profileData: any) => Promise<any>;
      'update-user-email'?: (userId: string, email: string) => Promise<any>;
      
      // Invite code methods
      checkInviteCode?: (inviteCode: string) => Promise<any>;
      markInviteCodeUsed?: (inviteCode: string, userId: string, email?: string, firstName?: string, lastName?: string) => Promise<any>;
      checkUserExists?: (userId: string) => Promise<any>;
      triggerTemplateCopy?: (userId: string) => Promise<any>;
      
      // PowerMic and dictation methods  
      onPowerMicRecordPressed?: (callback: () => void) => () => void;
      onPowerMicRecordReleased?: (callback: () => void) => () => void;
      onTriggerDictationToggle?: (callback: () => void) => () => void;
      
      // Report and impression generation triggers
      onTriggerReportGeneration?: (callback: () => void) => () => void;
      onTriggerImpressionGeneration?: (callback: () => void) => () => void;
      
      // Logic editor
      onOpenLogicEditor?: (callback: (data: { userId: string; studyType: string }) => void) => () => void;
      
      // Global impression prompt methods
      fetchGlobalImpressionPrompt?: () => Promise<any>;
      updateGlobalImpressionPrompt?: (userId: string, newPrompt: string) => Promise<any>;
      
      // Medical terms methods
      fetchMedicalTerms?: () => Promise<{ success: boolean; keywords?: any; error?: string }>;
      saveMedicalTerms?: (termsArray: Array<{ term: string; weight: number; category: string }>) => Promise<{ success: boolean; error?: string }>;
      addMedicalTerm?: (term: string, weight: number, category: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      deleteMedicalTerm?: (term: string, category: string) => Promise<{ success: boolean; error?: string }>;
      loadMedicalKeywordsFromDB?: () => Promise<{ success: boolean; error?: string }>;
    };
  }

  interface ImportMeta {
    readonly env: Record<string, string>;
  }
}

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string;
  export default value;
}

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag' | 'initial' | 'inherit' | 'unset';
  }
}

export {};