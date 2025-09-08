/**
 * Macro store with Supabase and IndexedDB offline fallback
 */

// Removed direct supabase import - using IPC instead
import type { Macro, MacroScope } from '../types/macro';

const DB_NAME = 'RadPalMacros';
const DB_VERSION = 1;
const STORE_NAME = 'macros';

class MacroStore {
  private db: IDBDatabase | null = null;
  private userId: string | null = null;
  private isOffline = false;

  constructor() {
    this.initIndexedDB();
    this.setupOfflineListener();
  }

  // Convert snake_case Supabase data to camelCase TypeScript format
  private convertFromSupabase(data: any): Macro {
    if (!data) return data;
    
    return {
      id: data.id,
      userId: data.user_id || data.userId,
      name: data.name,
      type: data.type,
      valueText: data.value_text || data.valueText,
      options: data.options,
      scope: data.scope,
      createdAt: data.created_at || data.createdAt,
      updatedAt: data.updated_at || data.updatedAt
    };
  }

  private async initIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('scope', 'scope', { unique: false });
          store.createIndex('userIdName', ['userId', 'name'], { unique: false });
        }
      };
    });
  }

  private setupOfflineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOffline = false;
      this.syncWithSupabase();
    });

    window.addEventListener('offline', () => {
      this.isOffline = true;
    });

    // Check initial state
    this.isOffline = !navigator.onLine;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  async listMacros(scope?: MacroScope): Promise<Macro[]> {
    if (!this.userId) {
      console.warn('No user ID set for macro store');
      return [];
    }

    // Try IPC first if online
    if (!this.isOffline && window.electronAPI?.listMacros) {
      try {
        const result = await window.electronAPI.listMacros(this.userId, scope);
        
        if (result.success && result.data) {
          // Convert array of snake_case to camelCase
          const macros = result.data.map((m: any) => this.convertFromSupabase(m));
          // Cache to IndexedDB
          if (this.db) {
            await this.cacheToIndexedDB(macros);
          }
          return macros;
        } else {
          throw new Error(result.error || 'Failed to fetch macros');
        }
      } catch (error) {
        console.error('Error fetching macros via IPC:', error);
        // Fall through to IndexedDB
      }
    }

    // Fallback to IndexedDB
    if (!this.db) {
      await this.initIndexedDB();
    }

    return this.getMacrosFromIndexedDB(scope);
  }

  async getMacroByName(name: string, scopeHint?: MacroScope): Promise<Macro | null> {
    if (!this.userId) {
      console.warn('No user ID set for macro store');
      return null;
    }

    // Normalize the name for comparison
    const normalizedName = name.toLowerCase().trim();

    // Try IPC first if online
    if (!this.isOffline && window.electronAPI?.getMacro) {
      try {
        const result = await window.electronAPI.getMacro(this.userId, normalizedName);
        
        if (result.success && result.data) {
          // Convert snake_case to camelCase
          const macro = this.convertFromSupabase(result.data);
          
          // If we have a scope hint, prioritize scope-specific macros
          if (scopeHint && macro.scope !== scopeHint && macro.scope !== 'global') {
            // This macro doesn't match our scope, try IndexedDB instead
            return this.getMacroFromIndexedDB(normalizedName, scopeHint);
          }
          
          return macro;
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching macro via IPC:', error);
        // Fall through to IndexedDB
      }
    }

    // Fallback to IndexedDB
    return this.getMacroFromIndexedDB(normalizedName, scopeHint);
  }

  async saveMacro(macro: Omit<Macro, 'id' | 'createdAt' | 'updatedAt'>): Promise<Macro> {
    if (!this.userId) {
      throw new Error('No user ID set for macro store');
    }

    const now = new Date().toISOString();
    const fullMacro: Macro = {
      ...macro,
      id: macro.id || crypto.randomUUID(),
      userId: this.userId,
      createdAt: now,
      updatedAt: now,
      scope: macro.scope || 'global'
    };

    // Try IPC first if online
    if (!this.isOffline && window.electronAPI?.saveMacro) {
      try {
        // Convert to Supabase format (snake_case)
        const supabaseMacro = {
          ...fullMacro,
          user_id: fullMacro.userId,
          created_at: fullMacro.createdAt,
          updated_at: fullMacro.updatedAt,
          value_text: fullMacro.valueText || '' // Map valueText to value_text
        };
        // Remove camelCase properties
        delete supabaseMacro.userId;
        delete supabaseMacro.createdAt;
        delete supabaseMacro.updatedAt;
        delete supabaseMacro.valueText; // Remove the camelCase version
        
        const result = await window.electronAPI.saveMacro(supabaseMacro);
        
        if (result.success && result.data) {
          // Convert snake_case to camelCase
          const savedMacro = this.convertFromSupabase(result.data);
          // Cache to IndexedDB
          if (this.db) {
            await this.saveMacroToIndexedDB(savedMacro);
          }
          return savedMacro;
        } else {
          throw new Error(result.error || 'Failed to save macro');
        }
      } catch (error) {
        console.error('Error saving macro via IPC:', error);
        // Fall through to IndexedDB
      }
    }

    // Fallback to IndexedDB
    await this.saveMacroToIndexedDB(fullMacro);
    return fullMacro;
  }

  async updateMacro(id: string, updates: Partial<Omit<Macro, 'id' | 'userId' | 'createdAt'>>): Promise<Macro> {
    if (!this.userId) {
      throw new Error('No user ID set for macro store');
    }

    const existingMacro = await this.getMacroById(id);
    if (!existingMacro) {
      throw new Error('Macro not found');
    }

    const updatedMacro: Macro = {
      ...existingMacro,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Try IPC first if online
    if (!this.isOffline && window.electronAPI?.saveMacro) {
      try {
        // Convert to Supabase format for update
        const supabaseMacro = {
          ...updatedMacro,
          user_id: this.userId,
          updated_at: updatedMacro.updatedAt,
          value_text: updatedMacro.valueText || '' // Map valueText to value_text
        };
        delete supabaseMacro.userId;
        delete supabaseMacro.updatedAt;
        delete supabaseMacro.valueText; // Remove the camelCase version
        
        const result = await window.electronAPI.saveMacro(supabaseMacro);
        
        if (result.success && result.data) {
          // Convert snake_case to camelCase
          const updatedMacro = this.convertFromSupabase(result.data);
          // Update in IndexedDB
          if (this.db) {
            await this.saveMacroToIndexedDB(updatedMacro);
          }
          return updatedMacro;
        } else {
          throw new Error(result.error || 'Failed to update macro');
        }
      } catch (error) {
        console.error('Error updating macro in Supabase:', error);
        // Fall through to IndexedDB
      }
    }

    // Fallback to IndexedDB
    await this.saveMacroToIndexedDB(updatedMacro);
    return updatedMacro;
  }

  async deleteMacro(id: string): Promise<void> {
    if (!this.userId) {
      throw new Error('No user ID set for macro store');
    }

    // Try IPC first if online
    if (!this.isOffline && window.electronAPI?.deleteMacro) {
      try {
        const result = await window.electronAPI.deleteMacro(this.userId, id);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete macro');
        }

        // Delete from IndexedDB
        if (this.db) {
          await this.deleteMacroFromIndexedDB(id);
        }

        return;
      } catch (error) {
        console.error('Error deleting macro from Supabase:', error);
        // Fall through to IndexedDB
      }
    }

    // Fallback to IndexedDB
    await this.deleteMacroFromIndexedDB(id);
  }

  // IndexedDB helper methods
  private async getMacrosFromIndexedDB(scope?: MacroScope): Promise<Macro[]> {
    if (!this.db || !this.userId) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(this.userId);

      request.onsuccess = () => {
        let macros = request.result || [];
        
        if (scope) {
          macros = macros.filter(m => 
            m.scope === scope || m.scope === 'global' || !m.scope
          );
        }

        resolve(macros);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getMacroFromIndexedDB(name: string, scopeHint?: MacroScope): Promise<Macro | null> {
    const macros = await this.getMacrosFromIndexedDB(scopeHint);
    const normalizedName = name.toLowerCase().trim();
    
    // Find exact match first
    let macro = macros.find(m => m.name.toLowerCase() === normalizedName);
    
    if (macro) {
      // If we have a scope hint and multiple matches, prioritize scope-specific
      if (scopeHint) {
        const scopeSpecific = macros.find(m => 
          m.name.toLowerCase() === normalizedName && m.scope === scopeHint
        );
        if (scopeSpecific) return scopeSpecific;
      }
      return macro;
    }

    return null;
  }

  private async getMacroById(id: string): Promise<Macro | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveMacroToIndexedDB(macro: Macro): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(macro);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteMacroFromIndexedDB(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheToIndexedDB(macros: Macro[]): Promise<void> {
    if (!this.db || !this.userId) return;

    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing user macros first
    const index = store.index('userId');
    const request = index.openCursor(IDBKeyRange.only(this.userId));
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // Now add all new macros
        macros.forEach(macro => store.add(macro));
      }
    };
  }

  private async syncWithSupabase(): Promise<void> {
    // This could be implemented to sync offline changes back to Supabase
    // For now, we'll just rely on fetching fresh data when online
    console.log('Back online - ready to sync with Supabase');
  }

  // Export/Import functionality
  async exportMacros(): Promise<string> {
    const macros = await this.listMacros();
    return JSON.stringify(macros, null, 2);
  }

  async importMacros(jsonString: string): Promise<void> {
    try {
      const macros = JSON.parse(jsonString) as Macro[];
      
      for (const macro of macros) {
        // Remove id to create new ones
        const { id, ...macroWithoutId } = macro;
        await this.saveMacro(macroWithoutId);
      }
    } catch (error) {
      throw new Error('Invalid macro JSON format');
    }
  }
}

// Singleton instance
export const macroStore = new MacroStore();