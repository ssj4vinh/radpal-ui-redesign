/**
 * Post-process generated impression to enforce exclusion rules
 * This ensures that excluded items are removed even if the AI includes them
 */
export function postProcessImpression(
  generatedText: string,
  agentLogic: Record<string, any>
): string {
  if (!agentLogic?.impression?.exclude_by_default || !Array.isArray(agentLogic.impression.exclude_by_default)) {
    return generatedText
  }
  
  let processedText = generatedText
  const excludeList = agentLogic.impression.exclude_by_default
  
  // Convert exclusion list to patterns to match
  const exclusionPatterns: RegExp[] = []
  
  excludeList.forEach((exclusion: string) => {
    // Convert snake_case to various formats
    const readable = exclusion.replace(/_/g, ' ').toLowerCase()
    const variants = [
      readable,
      readable.replace(/'/g, ''),  // Remove apostrophes
      readable.replace(/s$/, ''),   // Remove plural
      readable + 's'                 // Add plural
    ]
    
    // Create regex patterns for each variant
    variants.forEach(variant => {
      // Create pattern that matches the phrase in various contexts
      // Look for the phrase followed by punctuation, newline, or end of string
      const pattern = new RegExp(
        `\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[.,;\\n]|$)`,
        'gi'
      )
      exclusionPatterns.push(pattern)
    })
  })
  
  // Special handling for specific exclusions
  if (excludeList.some((e: string) => e.toLowerCase().includes('baker'))) {
    // More aggressive patterns for Baker's cyst
    exclusionPatterns.push(
      /\bsmall\s+baker'?s?\s+cysts?\b/gi,
      /\bbaker'?s?\s+cysts?,?\s+small\b/gi,
      /\d+\.\s*Small\s+Baker'?s?\s+cysts?\.?/gi  // Numbered list item
    )
  }
  
  if (excludeList.some((e: string) => e.toLowerCase().includes('effusion'))) {
    exclusionPatterns.push(
      /\bsmall\s+(?:joint\s+)?effusions?\b/gi,
      /\btrace\s+(?:joint\s+)?effusions?\b/gi,
      /\d+\.\s*Small\s+joint\s+effusions?\.?/gi  // Numbered list item
    )
  }
  
  // Apply exclusion patterns
  exclusionPatterns.forEach(pattern => {
    const matches = processedText.match(pattern)
    if (matches) {
      console.log(`🚫 Post-processing: Removing excluded item "${matches[0]}"`)
      
      // Remove the entire line if it's a numbered list item
      const numberedLinePattern = new RegExp(
        `^\\d+\\.\\s*.*${pattern.source}.*$`,
        'gim'
      )
      
      if (numberedLinePattern.test(processedText)) {
        processedText = processedText.replace(numberedLinePattern, '')
      } else {
        // Just remove the phrase
        processedText = processedText.replace(pattern, '')
      }
    }
  })
  
  // Clean up any resulting formatting issues
  // Remove empty numbered list items
  processedText = processedText.replace(/^\d+\.\s*$/gm, '')
  
  // Renumber list if needed
  const lines = processedText.split('\n')
  let itemNumber = 1
  const renumberedLines = lines.map(line => {
    const match = line.match(/^(\d+)\.\s+(.+)/)
    if (match) {
      const newLine = `${itemNumber}. ${match[2]}`
      itemNumber++
      return newLine
    }
    return line
  })
  
  processedText = renumberedLines.join('\n')
  
  // Remove multiple consecutive blank lines
  processedText = processedText.replace(/\n{3,}/g, '\n\n')
  
  // Trim whitespace
  processedText = processedText.trim()
  
  return processedText
}

/**
 * Check if a finding should be excluded based on the logic rules
 */
export function shouldExcludeFinding(
  finding: string,
  agentLogic: Record<string, any>
): boolean {
  if (!agentLogic?.impression?.exclude_by_default) {
    return false
  }
  
  const excludeList = agentLogic.impression.exclude_by_default
  const findingLower = finding.toLowerCase()
  
  // Check each exclusion rule
  for (const exclusion of excludeList) {
    const exclusionLower = exclusion.replace(/_/g, ' ').toLowerCase()
    
    // Check for exact match or close variations
    if (findingLower.includes(exclusionLower)) {
      return true
    }
    
    // Special checks for common variations
    if (exclusion.includes('baker')) {
      if (/small\s+baker'?s?\s+cysts?/i.test(finding)) {
        return true
      }
    }
    
    if (exclusion.includes('effusion')) {
      if (/small\s+(?:joint\s+)?effusions?/i.test(finding) ||
          /trace\s+(?:joint\s+)?effusions?/i.test(finding)) {
        return true
      }
    }
  }
  
  // Check muscle atrophy rules
  if (agentLogic.impression?.mention_muscle_atrophy_if) {
    const atrophyRule = agentLogic.impression.mention_muscle_atrophy_if
    
    if (findingLower.includes('muscle atrophy') || findingLower.includes('muscular atrophy')) {
      if (atrophyRule === 'never') {
        return true
      }
      if (atrophyRule === 'moderate_or_severe' && findingLower.includes('mild')) {
        return true
      }
      if (atrophyRule === 'severe' && (findingLower.includes('mild') || findingLower.includes('moderate'))) {
        return true
      }
    }
  }
  
  return false
}