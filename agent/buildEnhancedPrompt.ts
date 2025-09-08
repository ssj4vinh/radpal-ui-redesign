import { AgentLogic } from './types'

interface InstructionCategory {
  name: string
  priority: number
  instructions: string[]
}

export default function buildEnhancedPrompt(
  findings: string,
  template: string,
  agentLogic: Record<string, any>
): string {
  // Debug: Log the full agent logic structure
  console.log('🔍 BuildEnhancedPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2))
  
  // Check if this is V2 logic (has version and new structure)
  const isV2Logic = agentLogic.version === "3.0" || (agentLogic.general && agentLogic.report && agentLogic.impression)
  
  if (isV2Logic) {
    console.log('✅ Using V2 logic structure')
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
  
  // Start with the base instruction
  let prompt = 'You are an expert radiologist generating a comprehensive radiology report.\n\n'
  
  // Add template if provided with strong enforcement
  if (template) {
    prompt += 'TEMPLATE STRUCTURE - MANDATORY COMPLIANCE:\n\n'
    prompt += template + '\n\n'
    prompt += 'CRITICAL: Preserve ALL section headers (text ending with ":") EXACTLY as shown above.\n\n'
    prompt += 'CRITICAL SPACING RULE: Always include a space after colons in section headers (e.g., "Neurovascular structures: Unremarkable" NOT "Neurovascular structures:Unremarkable"). This spacing is mandatory and must be preserved exactly as shown in the template.\n\n'
  }
  
  // Add findings with maximum emphasis
  prompt += 'MANDATORY FINDINGS INCORPORATION:\n\n'
  prompt += '=== FINDINGS TO INCORPORATE ===\n'
  prompt += findings + '\n'
  prompt += '=== END OF FINDINGS ===\n\n'
  prompt += 'CRITICAL REQUIREMENT: Every single finding above MUST appear in the appropriate section of your report. Omitting any finding is unacceptable.\n\n'
  
  // Categorize instructions by priority
  const categories: InstructionCategory[] = []
  
  // CRITICAL RULES (Priority 1) - These MUST be followed
  const criticalRules: string[] = []
  
  // FORMATTING RULES (Priority 2) - Important for consistency
  const formattingRules: string[] = []
  
  // CONTENT RULES (Priority 3) - Enhance quality but flexible
  const contentRules: string[] = []
  
  // Process impression rules first (highest priority)
  if (agentLogic.impression) {
    // IMPRESSION FORMATTING RULES (Most Important)
    if (agentLogic.impression.numerically_itemized) {
      criticalRules.push('IMPRESSION FORMATTING: The impression section MUST be formatted as a numbered list (1, 2, 3, etc.). This is non-negotiable.')
      criticalRules.push('IMPRESSION SPACING: Separate each numbered item with a double line break.')
    } else {
      // Check for bullet points when not numerically itemized
      if (agentLogic.formatting?.use_bullet_points) {
        criticalRules.push('IMPRESSION FORMATTING: The impression section MUST be formatted as a bullet point list using • symbols.')
        criticalRules.push('IMPRESSION SPACING: Separate each bullet point with a double line break.')
        criticalRules.push('BULLET FORMAT: Start each item with "• " followed by the diagnosis/finding.')
      } else {
        // Paragraph format but still with proper spacing
        formattingRules.push('IMPRESSION SPACING: Write the impression as separate statements, each separated by a double line break.')
      }
    }
    
    if (agentLogic.impression.exclude_by_default && Array.isArray(agentLogic.impression.exclude_by_default) && agentLogic.impression.exclude_by_default.length > 0) {
      const excludeList = agentLogic.impression.exclude_by_default
      
      // Convert snake_case to readable phrases
      const readableExclusions = excludeList.map((item: string) => {
        return item.replace(/_/g, ' ').toLowerCase()
      })
      
      // Create strong exclusion instructions
      criticalRules.push('════════════════════════════════════════════')
      criticalRules.push('⚠️ MANDATORY EXCLUSION RULES FOR IMPRESSION:')
      
      readableExclusions.forEach((exclusion: string) => {
        criticalRules.push(`❌ DO NOT include "${exclusion}" in the impression section`)
      })
      
      // Add specific warnings for common issues
      if (readableExclusions.some((e: string) => e.includes('baker'))) {
        criticalRules.push('❌ SPECIFICALLY: Never mention "Small Baker\'s cyst" or any small Baker cyst in the impression')
      }
      
      criticalRules.push('════════════════════════════════════════════')
      criticalRules.push('These exclusions are MANDATORY unless causing active symptoms.')
    }
    
    if (agentLogic.impression.first_item_should_address_clinical_concern) {
      criticalRules.push('CLINICAL FOCUS: The first item in the impression MUST directly address the primary clinical concern or indication.')
    }
    
    if (agentLogic.impression.omit_minor_or_incidental_findings_unless_relevant) {
      contentRules.push('Focus the impression on clinically significant findings. Omit incidental findings unless they relate to the clinical history.')
    }
    
    if (agentLogic.impression.concise_summary) {
      contentRules.push('Keep the impression concise and focused on the most important findings.')
    }
    
    if (agentLogic.impression.include_recommendations) {
      contentRules.push('Include specific follow-up recommendations when clinically appropriate.')
    }
    
    // Handle mention_muscle_atrophy_if with strong enforcement
    if (agentLogic.impression.mention_muscle_atrophy_if) {
      console.log('🔍 Processing mention_muscle_atrophy_if:', agentLogic.impression.mention_muscle_atrophy_if)
      if (agentLogic.impression.mention_muscle_atrophy_if === 'moderate_or_severe') {
        criticalRules.push('MUSCLE ATROPHY RULE: Only mention muscle atrophy if it is explicitly described as moderate or severe. Do not mention mild muscle atrophy.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'severe') {
        criticalRules.push('MUSCLE ATROPHY RULE: Only mention muscle atrophy if it is explicitly described as severe. Do not mention mild or moderate muscle atrophy.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'never') {
        criticalRules.push('MUSCLE ATROPHY RULE: Do NOT mention muscle atrophy regardless of severity.')
      }
      // Note: 'any' case intentionally omitted to avoid unwanted muscle atrophy mentions
    }
  }
  
  // Process formatting rules
  if (agentLogic.formatting) {
    if (agentLogic.formatting.preserve_template_punctuation) {
      criticalRules.push('CRITICAL: Preserve ALL punctuation, spacing, and formatting EXACTLY as shown in the template. This includes spaces after colons (e.g., "Section: Content" not "Section:Content"), proper line breaks, and all other spacing.')
    }
    if (agentLogic.formatting.use_bullet_points) {
      formattingRules.push('Use bullet points for listing multiple findings within each section.')
    }
    if (agentLogic.formatting.capitalize_sections) {
      formattingRules.push('Ensure all section headers are in UPPERCASE.')
    }
  }
  
  // Process report-specific rules
  if (agentLogic.report) {
    if (agentLogic.report.no_hallucinated_findings) {
      criticalRules.push('ACCURACY RULE: Do not invent, assume, or hallucinate any findings. Only report what is explicitly stated in the provided findings.')
    }
    
    // Handle cartilage placement with strong enforcement
    if (agentLogic.report.cartilage_placement) {
      if (agentLogic.report.cartilage_placement.trochlear_cartilage_in_patellofemoral) {
        criticalRules.push('CARTILAGE PLACEMENT: Trochlear cartilage findings MUST be described within the patellofemoral compartment section.')
      }
      if (agentLogic.report.cartilage_placement.mention_patellar_if_trochlear_defect_present) {
        criticalRules.push('CARTILAGE CORRELATION: If any trochlear defect is present, you MUST explicitly state the condition of the patellar cartilage (intact or abnormal).')
      }
    }
    
    if (agentLogic.report.expand_lesions) {
      contentRules.push('For each lesion, describe location, size, morphology, and enhancement characteristics when available.')
    }
  }
  
  // Process clinical rules
  if (agentLogic.clinical) {
    if (agentLogic.clinical.correlate_with_symptoms) {
      contentRules.push('Correlate findings with clinical symptoms when clinical history is provided.')
    }
    if (agentLogic.clinical.mention_clinical_significance) {
      contentRules.push('Comment on the clinical significance of major findings.')
    }
  }
  
  // Process measurement rules
  if (agentLogic.measurements) {
    if (agentLogic.measurements.include_all_measurements) {
      formattingRules.push('Include all measurements mentioned in the findings.')
    }
    if (agentLogic.measurements.use_metric_system) {
      formattingRules.push('Use metric system (mm, cm) for all measurements.')
    }
  }
  
  // Process anatomy rules
  if (agentLogic.anatomy) {
    if (agentLogic.anatomy.combine_meniscus_and_cartilage_findings) {
      contentRules.push('Combine meniscus and cartilage findings in the same section for better organization.')
    }
    if (agentLogic.anatomy.group_by_anatomic_region) {
      contentRules.push('Group findings by anatomic region (e.g., anterior, posterior, medial, lateral).')
    }
  }
  
  // Process severity rules
  if (agentLogic.severity) {
    if (agentLogic.severity.use_standard_grading) {
      formattingRules.push('Use standard grading systems (e.g., mild/moderate/severe) consistently.')
    }
    if (agentLogic.severity.avoid_vague_terms) {
      formattingRules.push('Avoid vague terms like "some" or "several" - be specific.')
    }
  }
  
  // Process style rules
  if (agentLogic.style) {
    if (agentLogic.style.active_voice) {
      contentRules.push('Use active voice when describing findings.')
    }
    if (agentLogic.style.professional_tone) {
      contentRules.push('Maintain a professional, objective tone throughout.')
    }
  }
  
  // Add custom instructions (treat as critical)
  if (agentLogic.custom_instructions) {
    if (Array.isArray(agentLogic.custom_instructions)) {
      agentLogic.custom_instructions.forEach(instruction => {
        criticalRules.push(`CUSTOM RULE: ${instruction}`)
      })
    } else if (typeof agentLogic.custom_instructions === 'string') {
      criticalRules.push(`CUSTOM RULE: ${agentLogic.custom_instructions}`)
    }
  }
  
  // Build the prompt with prioritized rules
  if (criticalRules.length > 0) {
    prompt += 'CRITICAL RULES - MUST BE FOLLOWED:\n'
    criticalRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
    prompt += '\n'
  }
  
  if (formattingRules.length > 0) {
    prompt += 'FORMATTING REQUIREMENTS:\n'
    formattingRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
    prompt += '\n'
  }
  
  if (contentRules.length > 0) {
    prompt += 'CONTENT GUIDELINES:\n'
    contentRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
    prompt += '\n'
  }
  
  // Add examples if provided
  if (agentLogic.examples && Array.isArray(agentLogic.examples)) {
    prompt += 'EXAMPLES:\n'
    agentLogic.examples.forEach((example: any, index: number) => {
      if (example.context) {
        prompt += `Example ${index + 1} (${example.context}):\n`
      } else {
        prompt += `Example ${index + 1}:\n`
      }
      if (example.input) {
        prompt += `Input: ${example.input}\n`
      }
      if (example.output) {
        prompt += `Output: ${example.output}\n`
      }
      prompt += '\n'
    })
  }
  
  // Simple closing instruction
  prompt += 'Generate the complete radiology report now.\n'
  
  console.log('🚨 Enhanced prompt generated with prioritized rules')
  console.log(`Critical rules: ${criticalRules.length}, Formatting rules: ${formattingRules.length}, Content rules: ${contentRules.length}`)
  
  return prompt
}