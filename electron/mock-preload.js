const { contextBridge, ipcRenderer } = require('electron');

// Track login state - START LOGGED IN for UI development
const authState = {
  isLoggedIn: true,  // Start logged in
  currentSession: {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token', 
    expires_in: 3600,
    token_type: 'bearer',
    user: null  // Will be set below
  },
  authCallback: null
};

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

// Set the user in the session
authState.currentSession.user = mockUser;

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
  authSignIn: async (email, password) => {
    console.log('🔐 Mock sign in:', email);
    // Accept any email/password
    const signedInUser = { ...mockUser, email: email || mockUser.email };
    authState.currentSession = { 
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      user: signedInUser
    };
    authState.isLoggedIn = true;
    
    // Notify app of auth state change IMMEDIATELY
    if (authState.authCallback) {
      console.log('🔔 Triggering auth state change callback IMMEDIATELY with session:', authState.currentSession);
      // Provide the complete auth state expected by Supabase
      authState.authCallback({ 
        event: 'SIGNED_IN', 
        session: {
          access_token: authState.currentSession.access_token,
          refresh_token: authState.currentSession.refresh_token,
          expires_in: 3600,
          token_type: 'bearer',
          user: authState.currentSession.user
        }
      });
    }
    
    // Then resize window and trigger another auth update
    setTimeout(() => {
      console.log('📐 Triggering resize for main mode');
      ipcRenderer.send('resize-for-main-mode');
      
      // Send another auth state update to be sure
      if (authState.authCallback && authState.isLoggedIn) {
        console.log('🔔 Sending second auth state update');
        authState.authCallback({ 
          event: 'TOKEN_REFRESHED', 
          session: {
            access_token: authState.currentSession.access_token,
            refresh_token: authState.currentSession.refresh_token,
            expires_in: 3600,
            token_type: 'bearer',
            user: authState.currentSession.user
          }
        });
      }
    }, 100);
    
    return Promise.resolve({ 
      data: {
        user: signedInUser, 
        session: authState.currentSession
      },
      error: null
    });
  },
  authSignUp: async (email, password) => {
    console.log('📝 Mock sign up:', email);
    // Accept any email/password
    const signedUpUser = { ...mockUser, email: email || mockUser.email };
    authState.currentSession = { 
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      user: signedUpUser
    };
    authState.isLoggedIn = true;
    
    // Notify app of auth state change IMMEDIATELY
    if (authState.authCallback) {
      console.log('🔔 Triggering auth state change callback IMMEDIATELY with session:', authState.currentSession);
      // Provide the complete auth state expected by Supabase
      authState.authCallback({ 
        event: 'SIGNED_IN', 
        session: {
          access_token: authState.currentSession.access_token,
          refresh_token: authState.currentSession.refresh_token,
          expires_in: 3600,
          token_type: 'bearer',
          user: authState.currentSession.user
        }
      });
    }
    
    // Then resize window and trigger another auth update
    setTimeout(() => {
      console.log('📐 Triggering resize for main mode');
      ipcRenderer.send('resize-for-main-mode');
      
      // Send another auth state update to be sure
      if (authState.authCallback && authState.isLoggedIn) {
        console.log('🔔 Sending second auth state update');
        authState.authCallback({ 
          event: 'TOKEN_REFRESHED', 
          session: {
            access_token: authState.currentSession.access_token,
            refresh_token: authState.currentSession.refresh_token,
            expires_in: 3600,
            token_type: 'bearer',
            user: authState.currentSession.user
          }
        });
      }
    }, 100);
    
    return Promise.resolve({ 
      data: {
        user: signedUpUser, 
        session: authState.currentSession
      },
      error: null
    });
  },
  authSignOut: () => {
    console.log('🚪 Mock sign out');
    authState.isLoggedIn = false;
    authState.currentSession = null;
    
    // Notify app of sign out
    if (authState.authCallback) {
      console.log('🔔 Triggering auth state change for sign out');
      authState.authCallback({ 
        event: 'SIGNED_OUT', 
        session: null 
      });
    }
    
    return Promise.resolve({ error: null });
  },
  authGetSession: () => {
    console.log('📌 Mock get session, logged in:', authState.isLoggedIn);
    if (!authState.isLoggedIn || !authState.currentSession) {
      return Promise.resolve({ 
        data: { session: null },
        error: null
      });
    }
    // Return the session with the user included
    return Promise.resolve({ 
      data: { 
        session: authState.currentSession
      },
      error: null
    });
  },
  authGetUser: () => {
    console.log('Mock get user, logged in:', authState.isLoggedIn);
    if (!authState.isLoggedIn) {
      return Promise.resolve({ 
        data: { user: null },
        error: null
      });
    }
    return Promise.resolve({ 
      data: { user: authState.currentSession?.user || mockUser },
      error: null
    });
  },
  authSetupListener: () => Promise.resolve(),
  onAuthStateChange: (callback) => {
    // Store the callback to trigger it after login/logout
    authState.authCallback = callback;
    
    // Return unsubscribe function
    return () => {
      authState.authCallback = null;
    };
  },

  // User & Session
  setCurrentUser: (user) => {
    if (user) {
      authState.isLoggedIn = true;
      authState.currentSession = { ...authState.currentSession, user };
    }
    return Promise.resolve();
  },
  getCurrentUser: () => {
    console.log('Mock getCurrentUser, logged in:', authState.isLoggedIn);
    return Promise.resolve(authState.isLoggedIn ? (authState.currentSession?.user || mockUser) : null);
  },
  setSupabaseSession: (session) => {
    if (session) {
      authState.isLoggedIn = true;
      authState.currentSession = session;
    }
    return Promise.resolve();
  },
  getSupabaseSession: () => {
    console.log('Mock getSupabaseSession, logged in:', authState.isLoggedIn);
    return Promise.resolve(authState.isLoggedIn ? authState.currentSession : null);
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
  },
  
  // Auto-update - DISABLED for UI development
  checkForUpdates: () => {
    console.log('🚫 Auto-update disabled for UI development');
    return Promise.resolve({ updateAvailable: false });
  },
  onUpdateAvailable: (callback) => () => {},
  onUpdateDownloaded: (callback) => () => {},
  downloadUpdate: () => Promise.resolve(),
  quitAndInstall: () => console.log('Mock quit and install')
});

console.log('✅ Mock preload script loaded - UI development mode');
console.log('👤 Starting with user already logged in:', mockUser.email);