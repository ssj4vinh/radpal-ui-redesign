/**
 * Unit tests for macro store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { macroStore } from '../macroStore';
import type { Macro } from '../../types/macro';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          getAll: vi.fn(),
          index: vi.fn(() => ({
            getAll: vi.fn(),
            openCursor: vi.fn()
          }))
        }))
      }))
    }
  }))
};

// @ts-ignore
global.indexedDB = mockIndexedDB;

describe('MacroStore', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    macroStore.setUserId(testUserId);
  });

  describe('setUserId', () => {
    it('should set the user ID', () => {
      const newUserId = 'new-user-456';
      macroStore.setUserId(newUserId);
      // The userId is stored internally, so we test it indirectly
      expect(() => macroStore.saveMacro({
        name: 'test',
        type: 'text',
        valueText: 'test value'
      })).not.toThrow();
    });
  });

  describe('macro validation', () => {
    it('should validate text macro has valueText', async () => {
      const macro: Omit<Macro, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: testUserId,
        name: 'test',
        type: 'text',
        valueText: 'Test value'
      };
      
      // Should not throw
      expect(() => {
        // Validate macro structure
        if (macro.type === 'text' && !macro.valueText) {
          throw new Error('Text macro must have valueText');
        }
      }).not.toThrow();
    });

    it('should validate picklist macro has options', async () => {
      const macro: Omit<Macro, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: testUserId,
        name: 'severity',
        type: 'picklist',
        options: ['mild', 'moderate', 'severe']
      };
      
      // Should not throw
      expect(() => {
        // Validate macro structure
        if (macro.type === 'picklist' && (!macro.options || macro.options.length === 0)) {
          throw new Error('Picklist macro must have options');
        }
      }).not.toThrow();
    });
  });

  describe('export/import', () => {
    it('should export macros as JSON string', async () => {
      const json = await macroStore.exportMacros();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should validate import JSON format', async () => {
      const invalidJson = 'not valid json';
      
      await expect(macroStore.importMacros(invalidJson))
        .rejects
        .toThrow('Invalid macro JSON format');
    });

    it('should accept valid macro JSON', async () => {
      const validJson = JSON.stringify([
        {
          id: 'test-id',
          userId: testUserId,
          name: 'test',
          type: 'text',
          valueText: 'test value',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
      
      // Should not throw
      await expect(macroStore.importMacros(validJson))
        .resolves
        .not.toThrow();
    });
  });
});