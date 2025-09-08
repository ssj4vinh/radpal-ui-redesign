export default function buildEnhancedImpressionPrompt(
  findings: string,
  template: string,
  agentLogic: Record<string, any>
): string {
  // Debug: Log the full agent logic structure
  console.log('🔍 BuildEnhancedImpressionPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2))
  
  // Check if this is V2 logic (has version and new structure)
  const isV2Logic = agentLogic.version === "3.0" || (agentLogic.general && agentLogic.report && agentLogic.impression)
  
  if (isV2Logic) {
    console.log('✅ Using V2 logic structure for impression')
    // Map V2 structure to V1 for backward compatibility
    const mappedLogic: any = {
      formatting: {
        use_bullet_points: agentLogic.report?.formatting?.use_bullet_points || false,
        preserve_template_punctuation: agentLogic.report?.formatting?.preserve_template_punctuation || true,
        capitalize_sections: false,
        prevent_unnecessary_capitalization: agentLogic.report?.formatting?.prevent_unnecessary_capitalization || true,
        preserve_spacing_and_capitalization: agentLogic.report?.formatting?.preserve_spacing_and_capitalization || true
      },
      report: {
        no_hallucinated_findings: true,
        expand_lesions: agentLogic.report?.language?.expand_lesion_descriptions || false,
        avoid_words: agentLogic.report?.language?.avoid_words?.enabled ? agentLogic.report.language.avoid_words.words : [],
        avoid_phrases: agentLogic.report?.language?.avoid_phrases?.enabled ? agentLogic.report.language.avoid_phrases.phrases : []
      },
      impression: {
        numerically_itemized: agentLogic.impression?.format?.style === 'numerically_itemized',
        exclude_by_default: [
          ...(agentLogic.impression?.exclude_by_default || []),
          ...(agentLogic.study_impression?.exclude_by_default || [])
        ],
        first_item_should_address_clinical_concern: agentLogic.study_impression?.required_opening_phrase?.enabled || false,
        omit_minor_or_incidental_findings_unless_relevant: true,
        concise_summary: true
      },
      custom_instructions: agentLogic.custom_instructions || []
    }
    
    // Use mapped logic for processing
    agentLogic = mappedLogic
  }
  
  // Start with a strong base instruction
  let prompt = 'You are an expert radiologist generating a concise, well-formatted radiology impression.\n\n'
  
  // Skip template for impression generation - template is only for full report generation
  // The impression should be generated based on findings and logic rules only
  
  // Add findings with strong emphasis
  prompt += '📋 FINDINGS TO SUMMARIZE:\n'
  prompt += findings + '\n\n'
  
  // Critical instructions first
  const criticalInstructions: string[] = []
  const formattingInstructions: string[] = []
  const contentInstructions: string[] = []
  
  // CORE REQUIREMENT
  criticalInstructions.push('Generate ONLY the IMPRESSION section - do not include findings or other report sections.')
  
  // FORMATTING RULES (Most Important)
  if (agentLogic.impression) {
    if (agentLogic.impression.numerically_itemized) {
      criticalInstructions.push('IMPRESSION FORMAT: Write the impression as a numbered list (1, 2, 3, etc.).')
      criticalInstructions.push('SPACING: Separate each numbered item with a double line break.')
    } else {
      // Check for bullet points when not numerically itemized
      if (agentLogic.formatting?.use_bullet_points) {
        criticalInstructions.push('IMPRESSION FORMAT: Write the impression as a bullet point list using • symbols.')
        criticalInstructions.push('SPACING: Separate each bullet point with a double line break.')
        criticalInstructions.push('BULLET FORMAT: Start each item with "• " followed by the diagnosis/finding.')
      } else {
        // Paragraph format but still with proper spacing
        formattingInstructions.push('Write the impression as separate statements, each separated by a double line break.')
      }
    }
    
    // EXCLUSION RULES - MAKE THESE EXTREMELY STRICT
    if (agentLogic.impression.exclude_by_default && Array.isArray(agentLogic.impression.exclude_by_default) && agentLogic.impression.exclude_by_default.length > 0) {
      const excludeList = agentLogic.impression.exclude_by_default
      
      // Convert snake_case to readable phrases and create strict pattern matching
      const readableExclusions = excludeList.map((item: string) => {
        // Convert snake_case to readable format
        const readable = item.replace(/_/g, ' ').toLowerCase()
        return readable
      })
      
      // Create multiple exclusion instructions for emphasis
      criticalInstructions.push('═══════════════════════════════════════════')
      criticalInstructions.push('⚠️ STRICT EXCLUSION RULES - MUST FOLLOW:')
      criticalInstructions.push('═══════════════════════════════════════════')
      
      // List each exclusion individually for clarity
      readableExclusions.forEach((exclusion: string) => {
        criticalInstructions.push(`❌ EXCLUDE: "${exclusion}" - Do NOT mention this in the impression`)
      })
      
      // Add specific examples for common exclusions
      if (readableExclusions.some((e: string) => e.includes('baker'))) {
        criticalInstructions.push('❌ SPECIFICALLY: Do NOT mention "Small Baker\'s cyst" or "Small Baker cyst" or any variation')
      }
      
      if (readableExclusions.some((e: string) => e.includes('effusion'))) {
        criticalInstructions.push('❌ SPECIFICALLY: Do NOT mention "Small joint effusion" or "Trace joint effusion"')
      }
      
      criticalInstructions.push('═══════════════════════════════════════════')
      criticalInstructions.push('IMPORTANT: These exclusions are MANDATORY unless the finding is causing symptoms or requires immediate treatment.')
      criticalInstructions.push('Before including ANY finding, check if it matches the exclusion list above.')
    }
    
    // MUSCLE ATROPHY RULES (Fix the inconsistent mentions)
    if (agentLogic.impression.mention_muscle_atrophy_if) {
      console.log('🔍 Processing mention_muscle_atrophy_if:', agentLogic.impression.mention_muscle_atrophy_if)
      if (agentLogic.impression.mention_muscle_atrophy_if === 'moderate_or_severe') {
        criticalInstructions.push('MUSCLE ATROPHY: Only mention muscle atrophy if it is explicitly described as moderate or severe. Do NOT mention mild muscle atrophy.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'severe') {
        criticalInstructions.push('MUSCLE ATROPHY: Only mention muscle atrophy if it is explicitly described as severe. Do NOT mention mild or moderate muscle atrophy.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'never') {
        criticalInstructions.push('MUSCLE ATROPHY: Do NOT mention muscle atrophy regardless of severity.')
      }
      // Note: 'any' case intentionally omitted to avoid unwanted muscle atrophy mentions
    }
    
    // CLINICAL FOCUS
    if (agentLogic.impression.first_item_should_address_clinical_concern) {
      criticalInstructions.push('CLINICAL FOCUS: The first item MUST directly address the primary clinical concern or indication.')
    }
    
    // CONTENT RULES
    if (agentLogic.impression.omit_minor_or_incidental_findings_unless_relevant) {
      contentInstructions.push('Focus on clinically significant findings. Omit incidental findings unless they relate to the clinical history.')
    }
    
    if (agentLogic.impression.concise_summary) {
      contentInstructions.push('Keep the impression concise and focused on the most important findings.')
    }
    
    if (agentLogic.impression.include_recommendations) {
      contentInstructions.push('Include specific follow-up recommendations when clinically appropriate.')
    }
  }
  
  // ACCURACY RULES
  if (agentLogic.report?.no_hallucinated_findings) {
    criticalInstructions.push('ACCURACY: Do not invent, assume, or hallucinate any findings. Only summarize what is explicitly stated in the provided findings.')
  }
  
  // CLINICAL CORRELATION
  if (agentLogic.clinical) {
    if (agentLogic.clinical.correlate_with_symptoms) {
      contentInstructions.push('Correlate impression with clinical symptoms when clinical history is provided.')
    }
    if (agentLogic.clinical.mention_clinical_significance) {
      contentInstructions.push('Comment on the clinical significance of findings.')
    }
  }
  
  // CUSTOM INSTRUCTIONS (Treat as critical)
  if (agentLogic.custom_instructions) {
    if (Array.isArray(agentLogic.custom_instructions)) {
      agentLogic.custom_instructions.forEach(instruction => {
        criticalInstructions.push(`CUSTOM RULE: ${instruction}`)
      })
    } else if (typeof agentLogic.custom_instructions === 'string') {
      criticalInstructions.push(`CUSTOM RULE: ${agentLogic.custom_instructions}`)
    }
  }
  
  // Build the final prompt with prioritized sections
  if (criticalInstructions.length > 0) {
    prompt += '🚨 CRITICAL REQUIREMENTS:\n'
    criticalInstructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  }
  
  if (formattingInstructions.length > 0) {
    prompt += '📐 FORMATTING RULES:\n'
    formattingInstructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  }
  
  if (contentInstructions.length > 0) {
    prompt += '📝 CONTENT GUIDELINES:\n'
    contentInstructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  }
  
  // Final instruction with format examples
  prompt += '🎯 FINAL INSTRUCTIONS:\n'
  
  if (agentLogic.impression?.numerically_itemized) {
    prompt += 'Generate the impression in this EXACT format:\n\n'
    prompt += 'IMPRESSION:\n'
    prompt += '1. [Primary finding addressing clinical concern]\n\n'
    prompt += '2. [Secondary significant finding]\n\n'
    prompt += '3. [Additional findings if relevant]\n'
  } else if (agentLogic.formatting?.use_bullet_points) {
    prompt += 'Generate the impression in this EXACT format:\n\n'
    prompt += 'IMPRESSION:\n'
    prompt += '• [Primary finding addressing clinical concern]\n\n'
    prompt += '• [Secondary significant finding]\n\n'
    prompt += '• [Additional findings if relevant]\n'
  } else {
    prompt += 'Generate the impression with proper spacing:\n\n'
    prompt += 'IMPRESSION:\n'
    prompt += '[Statement about primary finding]\n\n'
    prompt += '[Statement about secondary finding]\n\n'
    prompt += '[Additional statements if relevant]\n'
  }
  
  prompt += '\nGenerate the impression now following the format requirements above.\n'
  
  console.log('🚨 Enhanced impression prompt generated')
  console.log(`Critical instructions: ${criticalInstructions.length}, Formatting: ${formattingInstructions.length}, Content: ${contentInstructions.length}`)
  
  return prompt
}