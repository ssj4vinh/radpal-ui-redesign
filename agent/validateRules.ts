interface ValidationResult {
  passed: boolean
  violations: string[]
  warnings: string[]
}

export default function validateRules(
  generatedReport: string,
  originalFindings: string,
  agentLogic: Record<string, any>
): ValidationResult {
  const violations: string[] = []
  const warnings: string[] = []
  
  console.log('🔍 Validating generated report against logic rules...')
  
  // Helper function to check if text is in impression section
  const getImpressionSection = (report: string): string => {
    const impressionMatch = report.match(/IMPRESSION:?\s*([\s\S]*?)(?:\n\n|\n[A-Z]+:|$)/i)
    return impressionMatch ? impressionMatch[1].trim() : ''
  }
  
  const impressionText = getImpressionSection(generatedReport)
  console.log('📝 Extracted impression:', impressionText.substring(0, 200) + '...')
  
  // Validate impression formatting
  if (agentLogic.impression?.numerically_itemized) {
    const hasNumberedList = /^\s*\d+\./.test(impressionText) || /\n\s*\d+\./.test(impressionText)
    if (!hasNumberedList) {
      violations.push('IMPRESSION FORMATTING: Report should use numbered list format (1, 2, 3, etc.) but does not.')
    }
  }
  
  // Validate exclude_by_default rules with exact phrase matching
  if (agentLogic.impression?.exclude_by_default && Array.isArray(agentLogic.impression.exclude_by_default)) {
    for (const excludedItem of agentLogic.impression.exclude_by_default) {
      // Create a more precise pattern to match the exact phrase
      const excludedLower = excludedItem.toLowerCase().trim()
      const impressionLower = impressionText.toLowerCase()
      
      // Use word boundary matching to find exact phrases
      const exactMatchPattern = new RegExp('\\b' + excludedLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')
      
      if (exactMatchPattern.test(impressionText)) {
        // Check if it seems clinically relevant (this is a heuristic)
        const hasSignificanceIndicators = impressionLower.includes('significant') ||
                                        impressionLower.includes('severe') ||
                                        impressionLower.includes('moderate') ||
                                        impressionLower.includes('concerning') ||
                                        impressionLower.includes('large') ||
                                        impressionLower.includes('extensive')
        
        if (!hasSignificanceIndicators) {
          violations.push(`EXCLUSION RULE VIOLATION: "${excludedItem}" appears in impression but should be excluded unless clinically relevant.`)
        }
      }
    }
  }
  
  // Validate muscle atrophy rules
  if (agentLogic.impression?.mention_muscle_atrophy_if) {
    const hasMuscleMention = impressionText.toLowerCase().includes('muscle') && 
                           (impressionText.toLowerCase().includes('atrophy') || impressionText.toLowerCase().includes('atrophic'))
    
    if (hasMuscleMention) {
      if (agentLogic.impression.mention_muscle_atrophy_if === 'moderate_or_severe') {
        const hasMild = impressionText.toLowerCase().includes('mild') && 
                       impressionText.toLowerCase().includes('muscle')
        if (hasMild) {
          violations.push('MUSCLE ATROPHY RULE VIOLATION: Mild muscle atrophy mentioned but rule specifies only moderate/severe should be included.')
        }
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'severe') {
        const hasMildOrModerate = (impressionText.toLowerCase().includes('mild') || 
                                  impressionText.toLowerCase().includes('moderate')) && 
                                 impressionText.toLowerCase().includes('muscle')
        if (hasMildOrModerate) {
          violations.push('MUSCLE ATROPHY RULE VIOLATION: Mild/moderate muscle atrophy mentioned but rule specifies only severe should be included.')
        }
      }
    }
  }
  
  // Validate no hallucinated findings rule
  if (agentLogic.report?.no_hallucinated_findings) {
    // This is a heuristic check - look for very specific measurements or findings that seem unlikely to be in original
    const suspiciousPatterns = [
      /\d+\.\d+ cm/g,  // Very specific measurements
      /\d+\.\d+ mm/g,
      /grade [IV]+/gi,  // Specific grading that might not be in findings
    ]
    
    // This is a warning rather than violation since it's hard to definitively detect hallucination
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(generatedReport) && !pattern.test(originalFindings)) {
        warnings.push('POTENTIAL HALLUCINATION: Report contains specific details that may not be in original findings.')
        break
      }
    }
  }
  
  // Validate findings incorporation
  const importantFindingKeywords = originalFindings.toLowerCase().match(/\b(tear|defect|lesion|edema|effusion|contusion|sprain|strain|fracture|abnormal|mass|cyst)\b/g) || []
  const reportLower = generatedReport.toLowerCase()
  
  for (const keyword of [...new Set(importantFindingKeywords)]) {
    if (!reportLower.includes(keyword)) {
      violations.push(`FINDINGS INCORPORATION: Important finding "${keyword}" from original findings may not be incorporated into report.`)
    }
  }
  
  // Validate cartilage placement rules
  if (agentLogic.report?.cartilage_placement?.mention_patellar_if_trochlear_defect_present) {
    const hasTrochlearDefect = generatedReport.toLowerCase().includes('trochlear') && 
                              (generatedReport.toLowerCase().includes('defect') || 
                               generatedReport.toLowerCase().includes('tear') ||
                               generatedReport.toLowerCase().includes('lesion'))
    
    if (hasTrochlearDefect) {
      const mentionsPatellar = generatedReport.toLowerCase().includes('patellar')
      if (!mentionsPatellar) {
        violations.push('CARTILAGE PLACEMENT RULE VIOLATION: Trochlear defect mentioned but patellar cartilage status not addressed.')
      }
    }
  }
  
  // Validate custom instructions (basic keyword matching)
  if (agentLogic.custom_instructions && Array.isArray(agentLogic.custom_instructions)) {
    for (const instruction of agentLogic.custom_instructions) {
      // Extract key terms from instruction for basic validation
      const keyTerms = instruction.toLowerCase().match(/\b(acl|pcl|meniscus|cartilage|ligament|integrity|status)\b/g) || []
      
      if (keyTerms.length > 0) {
        const hasKeyTerms = keyTerms.some(term => generatedReport.toLowerCase().includes(term))
        if (!hasKeyTerms) {
          warnings.push(`CUSTOM INSTRUCTION: May not be followed - "${instruction.substring(0, 50)}..."`)
        }
      }
    }
  }
  
  const passed = violations.length === 0
  
  console.log(`✅ Validation complete: ${passed ? 'PASSED' : 'FAILED'}`)
  console.log(`Violations: ${violations.length}, Warnings: ${warnings.length}`)
  
  return {
    passed,
    violations,
    warnings
  }
}