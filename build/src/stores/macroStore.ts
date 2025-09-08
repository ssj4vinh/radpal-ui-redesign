/**
 * Macro store with Supabase and IndexedDB offline fallback
 */

import { supabase } from '../lib/supabase';
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

    // Try Supabase first if online
    if (!this.isOffline) {
      try {
        let query = supabase
          .from('macros')
          .select('*')
          .eq('userId', this.userId)
          .order('name');

        if (scope) {
          // Include both the specific scope and global macros
          query = query.or(`scope.eq.${scope},scope.eq.global,scope.is.null`);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Cache to IndexedDB
        if (data && this.db) {
          await this.cacheToIndexedDB(data);
        }

        return data || [];
      } catch (error) {
        console.error('Error fetching macros from Supabase:', error);
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

    // Try Supabase first if online
    if (!this.isOffline) {
      try {
        let query = supabase
          .from('macros')
          .select('*')
          .eq('userId', this.userId)
          .ilike('name', normalizedName);

        if (scopeHint) {
          // Prioritize scope-specific, but include global as fallback
          query = query.or(`scope.eq.${scopeHint},scope.eq.global,scope.is.null`);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          // If we have a scope hint, prioritize scope-specific macros
          if (scopeHint) {
            const scopeSpecific = data.find(m => m.scope === scopeHint);
            if (scopeSpecific) return scopeSpecific;
          }
          
          // Return the first match (global or no scope)
          return data[0];
        }

        return null;
      } catch (error) {
        console.error('Error fetching macro from Supabase:', error);
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

    // Try Supabase first if online
    if (!this.isOffline) {
      try {
        const { data, error } = await supabase
          .from('macros')
          .upsert(fullMacro)
          .select()
          .single();

        if (error) throw error;

        // Cache to IndexedDB
        if (data && this.db) {
          await this.saveMacroToIndexedDB(data);
        }

        return data;
      } catch (error) {
        console.error('Error saving macro to Supabase:', error);
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

    // Try Supabase first if online
    if (!this.isOffline) {
      try {
        const { data, error } = await supabase
          .from('macros')
          .update(updatedMacro)
          .eq('id', id)
          .eq('userId', this.userId)
          .select()
          .single();

        if (error) throw error;

        // Update in IndexedDB
        if (data && this.db) {
          await this.saveMacroToIndexedDB(data);
        }

        return data;
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

    // Try Supabase first if online
    if (!this.isOffline) {
      try {
        const { error } = await supabase
          .from('macros')
          .delete()
          .eq('id', id)
          .eq('userId', this.userId);

        if (error) throw error;

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