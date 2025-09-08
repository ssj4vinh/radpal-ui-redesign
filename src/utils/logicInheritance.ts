/**
 * Logic Inheritance System
 * Handles merging of base logic with study-specific logic
 */

import { deepMergeAgentLogic, getDefaultAgentLogic } from './logicMerge'

export interface LogicLayers {
  defaultLogic?: any       // System default (hardcoded)
  baseLogic?: any          // User's base logic (from default_agent_logic)
  studySpecificLogic?: any // Study-specific overrides (from agent_logic)
}

export interface MergedLogicResult {
  mergedLogic: any
  layers: LogicLayers
  effectiveLogic: any
}

/**
 * Merges logic layers in order: default -> base -> study-specific
 * Each layer overrides/extends the previous one
 */
export function mergeLogicLayers(layers: LogicLayers): MergedLogicResult {
  // Start with system default
  let mergedLogic = layers.defaultLogic || getDefaultAgentLogic()
  
  // Apply user's base logic if exists
  if (layers.baseLogic) {
    mergedLogic = deepMergeAgentLogic(mergedLogic, layers.baseLogic)
  }
  
  // Apply study-specific overrides if exists
  if (layers.studySpecificLogic) {
    mergedLogic = deepMergeAgentLogic(mergedLogic, layers.studySpecificLogic)
  }
  
  return {
    mergedLogic,
    layers,
    effectiveLogic: mergedLogic
  }
}

/**
 * Extracts only the differences between two logic objects
 * Used to minimize storage by only saving deltas
 */
export function extractLogicDelta(baseLogic: any, modifiedLogic: any): any {
  if (!baseLogic || !modifiedLogic) return modifiedLogic
  
  const delta: any = {}
  
  for (const key in modifiedLogic) {
    const baseValue = baseLogic[key]
    const modifiedValue = modifiedLogic[key]
    
    // If values are different, include in delta
    if (JSON.stringify(baseValue) !== JSON.stringify(modifiedValue)) {
      if (typeof modifiedValue === 'object' && !Array.isArray(modifiedValue) && modifiedValue !== null) {
        // Recursively extract delta for nested objects
        const nestedDelta = extractLogicDelta(baseValue || {}, modifiedValue)
        if (Object.keys(nestedDelta).length > 0) {
          delta[key] = nestedDelta
        }
      } else {
        // For primitives and arrays, include the full value
        delta[key] = modifiedValue
      }
    }
  }
  
  return delta
}

/**
 * Validates that a logic object has required structure
 */
export function validateLogicStructure(logic: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!logic || typeof logic !== 'object') {
    errors.push('Logic must be an object')
    return { valid: false, errors }
  }
  
  // Check for required top-level keys
  const requiredKeys = ['formatting', 'report', 'impression']
  for (const key of requiredKeys) {
    if (!(key in logic)) {
      errors.push(`Missing required key: ${key}`)
    }
  }
  
  // Validate impression.exclude_by_default is an array if present
  if (logic.impression?.exclude_by_default && !Array.isArray(logic.impression.exclude_by_default)) {
    errors.push('impression.exclude_by_default must be an array')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Gets a human-readable summary of logic differences
 */
export function getLogicDiffSummary(baseLogic: any, modifiedLogic: any): string[] {
  const delta = extractLogicDelta(baseLogic, modifiedLogic)
  const summary: string[] = []
  
  const describeDiff = (obj: any, path: string = '') => {
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key
      const value = obj[key]
      
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        describeDiff(value, fullPath)
      } else if (Array.isArray(value)) {
        summary.push(`${fullPath}: ${value.length} items`)
      } else if (typeof value === 'boolean') {
        summary.push(`${fullPath}: ${value ? 'enabled' : 'disabled'}`)
      } else {
        summary.push(`${fullPath}: "${value}"`)
      }
    }
  }
  
  describeDiff(delta)
  return summary
}

/**
 * Determines which logic layer a specific setting comes from
 */
export function getLogicSource(key: string[], layers: LogicLayers): 'default' | 'base' | 'study' | null {
  const getValue = (obj: any, path: string[]): any => {
    let current = obj
    for (const k of path) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        return undefined
      }
    }
    return current
  }
  
  // Check study-specific first (highest priority)
  if (layers.studySpecificLogic && getValue(layers.studySpecificLogic, key) !== undefined) {
    return 'study'
  }
  
  // Check base logic
  if (layers.baseLogic && getValue(layers.baseLogic, key) !== undefined) {
    return 'base'
  }
  
  // Check default logic
  if (layers.defaultLogic && getValue(layers.defaultLogic, key) !== undefined) {
    return 'default'
  }
  
  return null
}