const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onPopupContent: (callback) => ipcRenderer.on('popup-content', (_event, data) => callback(data)),
  generateReport: (prompt) => ipcRenderer.invoke('generate-report', prompt),
  generateReportWithProvider: (prompt, provider) => ipcRenderer.invoke('generate-report-with-provider', prompt, provider),
  readPrompt: (name) => ipcRenderer.invoke('read-prompt', name),
  saveTextboxSize: (key, size) => ipcRenderer.invoke('save-textbox-size', { key, size }),
  getTextboxSize: (key) => ipcRenderer.invoke('get-textbox-size', key),
  setApiProvider: (provider) => ipcRenderer.invoke('set-api-provider', provider),
  getApiProvider: () => ipcRenderer.invoke('get-api-provider'),
  
  // Authentication methods for popups
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

  // Existing methods that need to be exposed to popups
  setCurrentUser: (user) => ipcRenderer.invoke('set-current-user', user),
  setSupabaseSession: (session) => ipcRenderer.invoke('set-supabase-session', session),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  getSupabaseSession: () => ipcRenderer.invoke('get-supabase-session'),
  
  // Supabase bridge methods for templates
  fetchTemplates: (userId, accessToken) => ipcRenderer.invoke('fetch-templates', userId, accessToken),
  saveTemplate: (templateData) => ipcRenderer.invoke('save-template', templateData),
  getTemplatePrompt: (studyType) => ipcRenderer.invoke('get-template-prompt', studyType),
  updateTemplatePrompt: (studyType, newPrompt) => ipcRenderer.invoke('update-template-prompt', studyType, newPrompt),
  getTemplateImpression: (studyType) => ipcRenderer.invoke('get-template-impression', studyType),
  updateTemplateImpression: (studyType, newPrompt) => ipcRenderer.invoke('update-template-impression', studyType, newPrompt),
  getUserTokenLimit: (userId) => ipcRenderer.invoke('get-user-token-limit', userId)
})

// ✅ Fix all popup access to ipcRenderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer
})
