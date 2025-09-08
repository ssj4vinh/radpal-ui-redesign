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