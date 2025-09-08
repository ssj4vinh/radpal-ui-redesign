/**
 * Deep merge utility for agent_logic objects
 * Handles arrays by concatenating unique values, objects by deep merging
 */
export function deepMergeAgentLogic(target: any, source: any): any {
  console.log('🔧 deepMergeAgentLogic called with:')
  console.log('🔧 Target (existing):', JSON.stringify(target, null, 2))
  console.log('🔧 Source (changes):', JSON.stringify(source, null, 2))
  
  if (!target || typeof target !== 'object') {
    console.log('🔧 Target is not object, returning source')
    return source
  }
  
  if (!source || typeof source !== 'object') {
    console.log('🔧 Source is not object, returning target')
    return target
  }

  const result = { ...target }
  console.log('🔧 Initial result (copy of target):', JSON.stringify(result, null, 2))

  for (const key in source) {
    const sourceValue = source[key]
    const targetValue = result[key]
    
    console.log(`🔧 Processing key "${key}":`)
    console.log(`🔧   - sourceValue:`, sourceValue)
    console.log(`🔧   - targetValue:`, targetValue)

    if (Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        // Merge arrays, removing duplicates
        const combined = [...targetValue, ...sourceValue]
        result[key] = [...new Set(combined)]
        console.log(`🔧   - Array merge result:`, result[key])
      } else {
        result[key] = [...sourceValue]
        console.log(`🔧   - Array replace result:`, result[key])
      }
    } else if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      // Recursively merge objects
      console.log(`🔧   - Recursively merging object for key "${key}"`)
      result[key] = deepMergeAgentLogic(targetValue || {}, sourceValue)
      console.log(`🔧   - Recursive merge result for "${key}":`, result[key])
    } else {
      // Primitive values - source overwrites target
      result[key] = sourceValue
      console.log(`🔧   - Primitive overwrite result for "${key}":`, result[key])
    }
  }

  console.log('🔧 Final merge result:', JSON.stringify(result, null, 2))
  return result
}

import { getDefaultStandardizedLogic } from './standardizedLogicSchema'

/**
 * Get default agent_logic structure
 * Now returns the new standardized format
 */
export function getDefaultAgentLogic() {
  return getDefaultStandardizedLogic();
}