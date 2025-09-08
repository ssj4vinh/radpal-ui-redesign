const { contextBridge, ipcRenderer } = require('electron');

let dictationTarget = 'PowerScribe';

ipcRenderer.on('update-dictation-target', (_, value) => {
  dictationTarget = value;
});

contextBridge.exposeInMainWorld('electronAPI', {
  generateReport: (prompt) => ipcRenderer.invoke('generate-report', prompt),
  generateReportWithProvider: (prompt, provider) => ipcRenderer.invoke('generate-report-with-provider', prompt, provider),
  readPrompt: (name) => ipcRenderer.invoke('read-prompt', name),
  getFindings: () => ipcRenderer.invoke('get-findings', dictationTarget),
  onPopupContent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('popup-content', handler);
    return () => ipcRenderer.removeListener('popup-content', handler);
  },
  onPopupTokens: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('popup-tokens', handler);
    return () => ipcRenderer.removeListener('popup-tokens', handler);
  },
  onWindowFocus: (callback) => {
    const handler = (_event, focused) => callback(focused);
    ipcRenderer.on('window-focus', handler);
    return () => ipcRenderer.removeListener('window-focus', handler);
  },
  resetWindowSize: () => ipcRenderer.send('reset-window-size'),
  setApiProvider: (provider) => ipcRenderer.invoke('set-api-provider', provider),
  getApiProvider: () => ipcRenderer.invoke('get-api-provider'),
  getTokenUsage: () => ipcRenderer.invoke('get-token-usage'),
  checkTokenLimit: () => ipcRenderer.invoke('check-token-limit'),
  getUserTier: (userId) => ipcRenderer.invoke('get-user-tier', userId),
  onTokenUsageUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('token-usage-updated', handler);
    return () => ipcRenderer.removeListener('token-usage-updated', handler);
  },
  saveTextboxSize: (key, size) => ipcRenderer.invoke('save-textbox-size', { key, size }),
  getTextboxSize: (key) => ipcRenderer.invoke('get-textbox-size', key),
  
  // Dictation methods
  startDictation: () => ipcRenderer.invoke('start-dictation'),
  stopDictation: () => ipcRenderer.invoke('stop-dictation'),
  isDictationActive: () => ipcRenderer.invoke('is-dictation-active'),
  forceResetDictation: () => ipcRenderer.invoke('force-reset-dictation'),
  onDictationText: (callback) => {
    const handler = (_event, text) => callback(text);
    ipcRenderer.on('dictation-text', handler);
    return () => ipcRenderer.removeListener('dictation-text', handler);
  },
  onDictationError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on('dictation-error', handler);
    return () => ipcRenderer.removeListener('dictation-error', handler);
  },

  // Audio capture methods for Web Audio API
  onStartAudioCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('start-audio-capture', handler);
    return () => ipcRenderer.removeListener('start-audio-capture', handler);
  },
  onStopAudioCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('stop-audio-capture', handler);
    return () => ipcRenderer.removeListener('stop-audio-capture', handler);
  },
  sendAudioData: (audioBuffer) => ipcRenderer.send('audio-data', audioBuffer),
  sendAudioError: (error) => ipcRenderer.send('audio-error', error),
  onResetAudioSystem: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('reset-audio-system', handler);
    return () => ipcRenderer.removeListener('reset-audio-system', handler);
  },
  onCriticalAudioError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on('critical-audio-error', handler);
    return () => ipcRenderer.removeListener('critical-audio-error', handler);
  },

  // Cleanup methods
  cleanupText: (inputText) => ipcRenderer.invoke('cleanup-text', inputText),
  isCleanupActive: () => ipcRenderer.invoke('is-cleanup-active'),
  onCleanupResult: (callback) => {
    const handler = (_event, cleanedText) => callback(cleanedText);
    ipcRenderer.on('cleanup-text-result', handler);
    return () => ipcRenderer.removeListener('cleanup-text-result', handler);
  },
  onCleanupError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on('cleanup-text-error', handler);
    return () => ipcRenderer.removeListener('cleanup-text-error', handler);
  },

  // Auto-cleanup methods
  autoCleanupText: (inputText) => ipcRenderer.invoke('auto-cleanup-text', inputText),
  setAutoCleanup: (enabled) => ipcRenderer.invoke('set-auto-cleanup', enabled),
  getAutoCleanup: () => ipcRenderer.invoke('get-auto-cleanup'),
  onDictationSessionComplete: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('dictation-session-complete', handler);
    return () => ipcRenderer.removeListener('dictation-session-complete', handler);
  },
  onDictationChunkComplete: (callback) => {
    const handler = (_event, chunkText) => callback(chunkText);
    ipcRenderer.on('dictation-chunk-complete', handler);
    return () => ipcRenderer.removeListener('dictation-chunk-complete', handler);
  },
  
  // Power Mic III events
  onPowerMicRecordPressed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('powermic-record-pressed', handler);
    return () => ipcRenderer.removeListener('powermic-record-pressed', handler);
  },
  onPowerMicRecordReleased: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('powermic-record-released', handler);
    return () => ipcRenderer.removeListener('powermic-record-released', handler);
  },
  onTriggerDictationToggle: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-dictation-toggle', handler);
    return () => ipcRenderer.removeListener('trigger-dictation-toggle', handler);
  },

  // Authentication methods
  authSignIn: (email, password) => ipcRenderer.invoke('auth-sign-in', email, password),
  authSignUp: (email, password) => ipcRenderer.invoke('auth-sign-up', email, password),
  authSignOut: () => ipcRenderer.invoke('auth-sign-out'),
  authGetSession: () => ipcRenderer.invoke('auth-get-session'),
  authGetUser: () => ipcRenderer.invoke('auth-get-user'),
  authSetupListener: () => ipcRenderer.invoke('auth-setup-listener'),
  onAuthStateChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('auth-state-change', handler);
    return () => ipcRenderer.removeListener('auth-state-change', handler);
  },

  // Existing methods that need to be exposed
  setCurrentUser: (user) => ipcRenderer.invoke('set-current-user', user),
  setSupabaseSession: (session) => ipcRenderer.invoke('set-supabase-session', session),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  getSupabaseSession: () => ipcRenderer.invoke('get-supabase-session'),
  
  // Login panel IPC methods
  checkInviteCode: (inviteCode) => ipcRenderer.invoke('check-invite-code', inviteCode),
  markInviteCodeUsed: (inviteCode, userId) => ipcRenderer.invoke('mark-invite-code-used', { inviteCode, userId }),
  checkUserExists: (userId) => ipcRenderer.invoke('check-user-exists', userId),
  triggerTemplateCopy: (userId) => ipcRenderer.invoke('trigger-template-copy', userId),
  
  // Logic editor listener
  onOpenLogicEditor: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('open-logic-editor', handler);
    return () => ipcRenderer.removeListener('open-logic-editor', handler);
  },

  // Templates updated listener
  onTemplatesUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('templates-updated', handler);
    return () => ipcRenderer.removeListener('templates-updated', handler);
  },

  // Window control methods
  contractWindow: () => ipcRenderer.send('contract-window'),
  minimizePopup: () => ipcRenderer.send('minimize-popup'),
  closePopup: () => ipcRenderer.send('close-popup'),
  expandWindow: () => ipcRenderer.send('expand-window'),
  resizeForLoginMode: () => {
    ipcRenderer.send('resize-for-login-mode');
  },
  resizeForMainMode: () => {
    try {
      // Test basic IPC communication first
      ipcRenderer.send('test-ipc-connection');
      // Test if login channel works from main mode (temporary debug)
      ipcRenderer.send('resize-for-login-mode-from-main');
      ipcRenderer.send('resize-for-main-mode');
    } catch (error) {
      console.error('Error sending resize-for-main-mode IPC:', error);
    }
  },
  saveLoginBounds: (bounds) => ipcRenderer.send('save-login-bounds', bounds),
  saveMainBounds: (bounds) => ipcRenderer.send('save-main-bounds', bounds),

  // Generic IPC send method
  send: (channel, content) => ipcRenderer.send(channel, content),
  
  // llama.cpp server status methods
  onLlamaServerStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('llama-server-status', handler);
    return () => ipcRenderer.removeListener('llama-server-status', handler);
  },
  onModelDownloadStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('model-download-status', handler);
    return () => ipcRenderer.removeListener('model-download-status', handler);
  },
  onCudaInstallProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('cuda-install-progress', handler);
    return () => ipcRenderer.removeListener('cuda-install-progress', handler);
  },
  onLlamaNotInstalled: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('llama-not-installed', handler);
    return () => ipcRenderer.removeListener('llama-not-installed', handler);
  },
  onLlamaUpdateAvailable: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('llama-update-available', handler);
    return () => ipcRenderer.removeListener('llama-update-available', handler);
  },
  getLlamaServerStatus: () => ipcRenderer.invoke('get-llama-server-status'),
  restartLlamaServer: () => ipcRenderer.invoke('restart-llama-server'),
  checkCudaSupport: () => ipcRenderer.invoke('check-cuda-support'),
  installCudaBinary: () => ipcRenderer.invoke('install-cuda-binary'),
  
  // Agent logic inheritance methods
  getLogicLayers: (userId, studyType) => ipcRenderer.invoke('get-logic-layers', userId, studyType),
  updateBaseLogic: (userId, baseLogic) => ipcRenderer.invoke('update-base-logic', userId, baseLogic),
  updateStudyLogic: (userId, studyType, studyLogic) => ipcRenderer.invoke('update-study-logic', userId, studyType, studyLogic),
  
  // Auto-update methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateCheckComplete: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-check-complete', handler);
    return () => ipcRenderer.removeListener('update-check-complete', handler);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
});

// Only expose safe IPC methods through electron namespace
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (...args) => ipcRenderer.invoke(...args),
    send: (...args) => ipcRenderer.send(...args),
    on: (channel, listener) => {
      // Only allow specific safe channels
      const allowedChannels = ['llama-server-status', 'model-download-status'];
      if (allowedChannels.includes(channel)) {
        ipcRenderer.on(channel, listener);
      }
    },
    removeListener: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener);
    }
  }
});
