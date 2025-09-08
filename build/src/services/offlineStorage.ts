// Offline storage service for handling Supabase data when offline
const STORAGE_KEYS = {
  USER: 'radpal_offline_user',
  SESSION: 'radpal_offline_session',
  TEMPLATES: 'radpal_offline_templates',
  OFFLINE_ONLY_TEMPLATES: 'radpal_offline_only_templates', // Separate storage for offline-only edits
  SETTINGS: 'radpal_offline_settings',
  AGENT_LOGIC: 'radpal_offline_agent_logic',
  LAST_SYNC: 'radpal_offline_last_sync'
}

export interface OfflineUser {
  id: string
  email?: string
  user_metadata?: any
}

export interface OfflineSession {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: OfflineUser
}

class OfflineStorageService {
  // User and Session Management
  saveUser(user: OfflineUser): void {
    if (!user?.id) return
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  }

  getUser(): OfflineUser | null {
    const stored = localStorage.getItem(STORAGE_KEYS.USER)
    return stored ? JSON.parse(stored) : null
  }

  saveSession(session: OfflineSession): void {
    if (!session) return
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session))
    if (session.user) {
      this.saveUser(session.user)
    }
  }

  getSession(): OfflineSession | null {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION)
    return stored ? JSON.parse(stored) : null
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSION)
    localStorage.removeItem(STORAGE_KEYS.USER)
  }

  // Templates Management
  saveTemplates(templates: Record<string, any>): void {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates))
    this.updateLastSync()
  }

  getTemplates(): Record<string, any> {
    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES)
    return stored ? JSON.parse(stored) : {}
  }
  
  // Offline-only Templates Management (separate from synced templates)
  saveOfflineOnlyTemplates(templates: Record<string, any>): void {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_ONLY_TEMPLATES, JSON.stringify(templates))
  }

  getOfflineOnlyTemplates(): Record<string, any> {
    const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_ONLY_TEMPLATES)
    return stored ? JSON.parse(stored) : {}
  }

  // Settings Management
  saveSettings(settings: any): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
    this.updateLastSync()
  }

  getSettings(): any {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return stored ? JSON.parse(stored) : null
  }

  // Agent Logic Management
  saveAgentLogic(studyType: string, logic: any): void {
    const allLogic = this.getAllAgentLogic()
    allLogic[studyType] = {
      ...logic,
      lastModified: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEYS.AGENT_LOGIC, JSON.stringify(allLogic))
  }

  getAgentLogic(studyType: string): any | null {
    const allLogic = this.getAllAgentLogic()
    return allLogic[studyType] || null
  }

  getAllAgentLogic(): Record<string, any> {
    const stored = localStorage.getItem(STORAGE_KEYS.AGENT_LOGIC)
    return stored ? JSON.parse(stored) : {}
  }

  // Sync Management
  updateLastSync(): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString())
  }

  getLastSync(): Date | null {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
    return stored ? new Date(stored) : null
  }

  // Utility Methods
  isOfflineDataAvailable(): boolean {
    return !!(this.getUser() && this.getTemplates())
  }

  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }

  // Export/Import for backup
  exportOfflineData(): any {
    return {
      user: this.getUser(),
      session: this.getSession(),
      templates: this.getTemplates(),
      offlineOnlyTemplates: this.getOfflineOnlyTemplates(),
      settings: this.getSettings(),
      agentLogic: this.getAllAgentLogic(),
      lastSync: this.getLastSync()
    }
  }

  importOfflineData(data: any): void {
    if (data.user) this.saveUser(data.user)
    if (data.session) this.saveSession(data.session)
    if (data.templates) this.saveTemplates(data.templates)
    if (data.offlineOnlyTemplates) this.saveOfflineOnlyTemplates(data.offlineOnlyTemplates)
    if (data.settings) this.saveSettings(data.settings)
    if (data.agentLogic) {
      localStorage.setItem(STORAGE_KEYS.AGENT_LOGIC, JSON.stringify(data.agentLogic))
    }
    if (data.lastSync) {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, data.lastSync)
    }
  }

  // Legacy compatibility method - acts as a bridge for old code
  setOfflineUser(user: any): void {
    console.log('🔍 Legacy setOfflineUser called on storage service with:', user)
    if (user) {
      this.saveUser(user)
    }
  }
}

export const offlineStorage = new OfflineStorageService()