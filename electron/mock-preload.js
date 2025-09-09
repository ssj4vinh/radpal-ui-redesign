const { contextBridge, ipcRenderer } = require('electron');

// Track login state
let isLoggedIn = false;
let currentSession = null;

// Mock data
const mockUser = {
  id: 'test-user-123',
  email: 'demo@radpal.com',
  firstName: 'Demo',
  lastName: 'User',
  tier: 3,
  subscription: {
    tier: 3,
    name: 'Premium',
    token_limit: 50
  }
};

const mockTemplates = [
  { id: 1, name: 'Normal Study', content: 'No acute findings.' },
  { id: 2, name: 'Degenerative Changes', content: 'Mild degenerative changes.' }
];

const mockMedicalTerms = {
  anatomy: {
    'acetabulum': 3,
    'meniscus': 3,
    'labrum': 3,
    'cruciate': 3,
    'collateral': 3
  },
  pathology: {
    'tendinosis': 3,
    'tendinopathy': 3,
    'effusion': 3,
    'edema': 3
  },
  custom: {
    'sample term': 2
  }
};

const mockReports = [
  {
    id: 1,
    created_at: new Date().toISOString(),
    findings: 'Sample findings text',
    impression: 'Sample impression',
    study_type: 'MRI Brain',
    submitted_as_dataset: true
  },
  {
    id: 2,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    findings: 'Another sample findings',
    impression: 'Another impression',
    study_type: 'CT Chest',
    submitted_as_dataset: false
  }
];

// Mock API
contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  authSignIn: (email, password) => {
    console.log('🔐 Mock sign in:', email);
    // Accept any email/password
    isLoggedIn = true;
    const signedInUser = { ...mockUser, email: email || mockUser.email };
    currentSession = { 
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      user: signedInUser
    };
    
    // Trigger window resize after successful login
    setTimeout(() => {
      console.log('📐 Triggering resize for main mode');
      ipcRenderer.send('resize-for-main-mode');
    }, 100);
    
    return Promise.resolve({ 
      data: {
        user: signedInUser, 
        session: currentSession
      },
      error: null
    });
  },
  authSignUp: (email, password) => {
    console.log('📝 Mock sign up:', email);
    // Accept any email/password
    isLoggedIn = true;
    const signedUpUser = { ...mockUser, email: email || mockUser.email };
    currentSession = { 
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      user: signedUpUser
    };
    
    // Trigger window resize after successful signup
    setTimeout(() => {
      console.log('📐 Triggering resize for main mode');
      ipcRenderer.send('resize-for-main-mode');
    }, 100);
    
    return Promise.resolve({ 
      data: {
        user: signedUpUser, 
        session: currentSession
      },
      error: null
    });
  },
  authSignOut: () => {
    console.log('Mock sign out');
    isLoggedIn = false;
    currentSession = null;
    return Promise.resolve({ error: null });
  },
  authGetSession: () => {
    console.log('Mock get session, logged in:', isLoggedIn);
    if (!isLoggedIn) {
      return Promise.resolve({ 
        data: { session: null },
        error: null
      });
    }
    return Promise.resolve({ 
      data: { session: currentSession },
      error: null
    });
  },
  authGetUser: () => {
    console.log('Mock get user, logged in:', isLoggedIn);
    if (!isLoggedIn) {
      return Promise.resolve({ 
        data: { user: null },
        error: null
      });
    }
    return Promise.resolve({ 
      data: { user: currentSession?.user || mockUser },
      error: null
    });
  },
  authSetupListener: () => Promise.resolve(),
  onAuthStateChange: (callback) => {
    // Don't auto-login - wait for actual login
    // Return unsubscribe function
    return () => {};
  },

  // User & Session
  setCurrentUser: (user) => {
    if (user) {
      isLoggedIn = true;
      currentSession = { ...currentSession, user };
    }
    return Promise.resolve();
  },
  getCurrentUser: () => {
    return Promise.resolve(isLoggedIn ? (currentSession?.user || mockUser) : null);
  },
  setSupabaseSession: (session) => {
    if (session) {
      isLoggedIn = true;
      currentSession = session;
    }
    return Promise.resolve();
  },
  getSupabaseSession: () => {
    return Promise.resolve(isLoggedIn ? currentSession : null);
  },
  
  // Templates
  fetchTemplates: () => Promise.resolve(mockTemplates),
  createTemplate: (template) => {
    console.log('Mock create template:', template);
    return Promise.resolve({ id: Date.now(), ...template });
  },
  updateTemplate: (id, updates) => {
    console.log('Mock update template:', id, updates);
    return Promise.resolve({ id, ...updates });
  },
  deleteTemplate: (id) => {
    console.log('Mock delete template:', id);
    return Promise.resolve({ success: true });
  },
  onTemplatesUpdated: (callback) => {
    return () => {};
  },

  // Medical Terms
  fetchMedicalTerms: () => Promise.resolve({ success: true, keywords: mockMedicalTerms }),
  saveMedicalTerms: (terms) => {
    console.log('Mock save medical terms:', terms);
    return Promise.resolve({ success: true });
  },
  addMedicalTerm: (term, weight, category) => {
    console.log('Mock add medical term:', term, weight, category);
    return Promise.resolve({ success: true });
  },
  deleteMedicalTerm: (term, category) => {
    console.log('Mock delete medical term:', term, category);
    return Promise.resolve({ success: true });
  },

  // Reports
  generateReport: (findings, studyType, options) => {
    console.log('Mock generate report:', studyType);
    return Promise.resolve({
      success: true,
      report: `FINDINGS:\n${findings}\n\nIMPRESSION:\nSample generated impression based on the findings.`,
      usage: { input_tokens: 100, output_tokens: 50 }
    });
  },
  generateImpression: (findings, options) => {
    console.log('Mock generate impression');
    return Promise.resolve({
      success: true,
      impression: 'Sample generated impression text.',
      usage: { input_tokens: 50, output_tokens: 25 }
    });
  },
  fetchReports: () => Promise.resolve(mockReports),
  fetchReportsByStudyType: (studyType) => {
    return Promise.resolve(mockReports.filter(r => r.study_type === studyType));
  },
  saveReport: (report) => {
    console.log('Mock save report:', report);
    return Promise.resolve({ success: true, id: Date.now() });
  },
  deleteReport: (id) => {
    console.log('Mock delete report:', id);
    return Promise.resolve({ success: true });
  },
  submitDataset: (dataset) => {
    console.log('Mock submit dataset:', dataset);
    return Promise.resolve({ success: true });
  },

  // Macros
  listMacros: (userId, scope) => Promise.resolve([
    { id: 1, name: 'normal', text: 'Normal appearance.', scope: 'global' },
    { id: 2, name: 'unremarkable', text: 'Unremarkable.', scope: 'user' }
  ]),
  getMacro: (userId, name) => Promise.resolve({ 
    id: 1, 
    name: name, 
    text: 'Sample macro text.', 
    scope: 'user' 
  }),
  saveMacro: (macro) => {
    console.log('Mock save macro:', macro);
    return Promise.resolve({ success: true });
  },
  deleteMacro: (userId, macroId) => {
    console.log('Mock delete macro:', macroId);
    return Promise.resolve({ success: true });
  },

  // Logic Editor
  fetchLogic: (userId, context) => Promise.resolve({
    logic: { rules: [], version: '1.0' }
  }),
  saveLogic: (logic) => {
    console.log('Mock save logic:', logic);
    return Promise.resolve({ success: true });
  },
  onOpenLogicEditor: (callback) => {
    return () => {};
  },

  // Dictation (mock - won't actually record)
  startDictation: () => {
    console.log('Mock start dictation');
    return Promise.resolve({ success: true });
  },
  stopDictation: () => {
    console.log('Mock stop dictation');
    return Promise.resolve({ success: true });
  },
  getDictationStatus: () => Promise.resolve({ isRecording: false }),
  checkDictationAccess: () => Promise.resolve({ 
    authorized: true, 
    minutesUsed: 5, 
    minutesRemaining: 25, 
    dailyLimit: 30 
  }),
  onDictationChunkComplete: (callback) => {
    // Simulate dictation chunks
    return () => {};
  },
  onDictationSessionComplete: (callback) => {
    return () => {};
  },

  // Window controls
  expandWindow: () => ipcRenderer.send('expand-window'),
  contractWindow: () => ipcRenderer.send('contract-window'),
  minimizePopup: () => ipcRenderer.send('minimize-popup'),
  closePopup: () => ipcRenderer.send('close-popup'),
  closeApp: () => ipcRenderer.send('quit-app'),
  closeAppGentle: () => ipcRenderer.send('quit-app'),
  resizeForLoginMode: () => console.log('Mock resize for login'),
  resizeForMainMode: () => console.log('Mock resize for main'),

  // Settings
  getAutoCleanup: () => Promise.resolve(true),
  setAutoCleanup: (value) => {
    console.log('Mock set auto cleanup:', value);
    return Promise.resolve();
  },

  // Other UI events
  onPowerMicRecordPressed: (callback) => () => {},
  onPowerMicRecordReleased: (callback) => () => {},
  onTriggerDictationToggle: (callback) => () => {},
  onTriggerReportGeneration: (callback) => () => {},
  onTriggerImpressionGeneration: (callback) => () => {},

  // Utility - Fixed to match expected response structure
  checkInviteCode: (code) => {
    console.log('Mock check invite code:', code);
    return Promise.resolve({ 
      data: { valid: true },
      error: null 
    });
  },
  markInviteCodeUsed: (data) => {
    console.log('Mock mark invite code used:', data);
    return Promise.resolve({ 
      data: { success: true },
      error: null 
    });
  },
  checkUserExists: (userId) => {
    console.log('Mock check user exists:', userId);
    return Promise.resolve({ 
      data: { exists: false }, // Return false so it doesn't block signup
      error: null 
    });
  },
  triggerTemplateCopy: (userId) => {
    console.log('Mock trigger template copy:', userId);
    return Promise.resolve({ 
      data: { success: true },
      error: null 
    });
  },
  
  // User Profile
  fetchUserProfile: (userId) => Promise.resolve({
    displayName: 'Demo User',
    firstName: 'Demo',
    lastName: 'User',
    credentials: 'MD',
    npiNumber: '1234567890'
  }),
  saveUserProfile: (profile) => {
    console.log('Mock save user profile:', profile);
    return Promise.resolve({ success: true });
  }
});

console.log('Mock preload script loaded - UI development mode');