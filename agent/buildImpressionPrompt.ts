// For backward compatibility, accept either merged logic or raw logic
export default function buildImpressionPrompt(
  findings: string,
  template: string,
  agentLogic: Record<string, any>
): string {
  // Debug: Log the full agent logic structure
  console.log('🔍 BuildImpressionPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2))
  
  // Check if this is V2 logic (has version and new structure)
  const isV2Logic = agentLogic.version === "3.0" || (agentLogic.general && agentLogic.report && agentLogic.impression)
  
  if (isV2Logic) {
    console.log('✅ Using V2 logic structure in buildImpressionPrompt')
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
  
  // Start with the base instruction for impression generation
  let prompt = 'You are an expert radiologist generating a concise radiology impression.\n\n'
  
  // Skip template for impression generation - template is only for full report generation
  // The impression should be generated based on findings and logic rules only
  
// Add findings
prompt += 'The following imaging findings have been identified and must be incorporated into the impression:\n'
prompt += findings + '\n\n'
  
  // Build impression-specific instructions
  const instructions: string[] = []
  
  // Core impression instructions
  instructions.push('Generate ONLY the IMPRESSION section - do not include findings or other report sections.')
  
  // Impression formatting
  if (agentLogic.impression) {
    if (agentLogic.impression.numerically_itemized) {
      instructions.push('Write the impression as a numbered list.')
    }
    if (agentLogic.impression.omit_minor_or_incidental_findings_unless_relevant) {
      instructions.push('Omit incidental findings unless relevant to the clinical history.')
    }
    if (agentLogic.impression.concise_summary) {
      instructions.push('Keep the impression concise, focusing only on clinically significant findings.')
    }
    if (agentLogic.impression.include_recommendations) {
      instructions.push('Include follow-up recommendations when appropriate.')
    }
    if (agentLogic.impression.differential_diagnosis) {
      instructions.push('Provide differential diagnoses for significant findings when appropriate.')
    }
    if (agentLogic.impression.severity_classification) {
      instructions.push('Classify findings by severity (mild, moderate, severe) when applicable.')
    }
    if (agentLogic.impression.prioritize_by_urgency) {
      instructions.push('List findings in order of clinical urgency, most urgent first.')
    }
    
    // Handle new nested impression rules
    if (agentLogic.impression.first_item_should_address_clinical_concern) {
      instructions.push('The first impression item should address the clinical concern.')
    }
    
    // Handle exclude_by_default array
    if (agentLogic.impression.exclude_by_default && Array.isArray(agentLogic.impression.exclude_by_default)) {
      console.log('🔍 Processing exclude_by_default:', agentLogic.impression.exclude_by_default)
      const excludeList = agentLogic.impression.exclude_by_default.join(', ')
      instructions.push(`Do not include the following EXACT phrases unless clinically relevant: ${excludeList}. Note: Only exclude the EXACT phrases listed - similar but different findings should still be included.`)
    }
    
    // Handle mention_muscle_atrophy_if
    if (agentLogic.impression.mention_muscle_atrophy_if) {
      console.log('🔍 Processing mention_muscle_atrophy_if:', agentLogic.impression.mention_muscle_atrophy_if)
      if (agentLogic.impression.mention_muscle_atrophy_if === 'moderate_or_severe') {
        instructions.push('Only mention muscle atrophy if it is moderate or severe.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'severe') {
        instructions.push('Only mention muscle atrophy if it is severe.')
      } else if (agentLogic.impression.mention_muscle_atrophy_if === 'any') {
        instructions.push('Mention muscle atrophy regardless of severity.')
      }
    }
    
    // Handle combine_compartments
    if (agentLogic.impression.combine_compartments) {
      instructions.push('Combine meniscus and cartilage findings by compartment (e.g., medial/lateral) in the impression.')
    }
    
    // Handle exclude_unless_surgical
    if (agentLogic.impression.exclude_unless_surgical && Array.isArray(agentLogic.impression.exclude_unless_surgical)) {
      console.log('🔍 Processing exclude_unless_surgical:', agentLogic.impression.exclude_unless_surgical)
      const surgicalList = agentLogic.impression.exclude_unless_surgical.join(', ')
      instructions.push(`Exclude the following findings unless they require surgical intervention: ${surgicalList}.`)
    }
  }
  
  // Report logic that affects impressions
  if (agentLogic.report) {
    if (agentLogic.report.no_hallucinated_findings) {
      instructions.push('Do not invent findings. Only summarize what is explicitly stated in the findings.')
    }
    
    // Handle cartilage placement rules for impressions
    if (agentLogic.report.cartilage_placement) {
      if (agentLogic.report.cartilage_placement.group_cartilage_by_compartment_in_impression) {
        instructions.push('Group cartilage findings by compartment (medial, lateral, patellofemoral) in the impression.')
      }
      if (agentLogic.report.cartilage_placement.mention_grade_in_impression) {
        instructions.push('Include cartilage defect grades in the impression when available.')
      }
    }
    
    // Handle anatomic routing rules that affect impression organization
    if (agentLogic.report.anatomic_routing_rules) {
      console.log('🔍 Processing anatomic_routing_rules for impression:', agentLogic.report.anatomic_routing_rules)
      
      if (agentLogic.report.anatomic_routing_rules.impression_order) {
        instructions.push(`Organize impression findings in this order: ${agentLogic.report.anatomic_routing_rules.impression_order}.`)
      }
      if (agentLogic.report.anatomic_routing_rules.group_pathology_by_type) {
        instructions.push('Group similar pathology together in the impression (e.g., all ligament tears, all cartilage defects).')
      }
    }
  }
  
  // Formatting preferences
  if (agentLogic.formatting) {
    if (agentLogic.formatting.use_bullet_points) {
      instructions.push('Use bullet points when listing multiple diagnoses or findings.')
    }
    if (agentLogic.formatting.capitalize_diagnoses) {
      instructions.push('Capitalize the first letter of each diagnosis or major finding.')
    }
  }
  
  // Clinical correlation
  if (agentLogic.clinical) {
    if (agentLogic.clinical.correlate_with_symptoms) {
      instructions.push('Correlate impression with clinical symptoms when provided.')
    }
    if (agentLogic.clinical.mention_clinical_significance) {
      instructions.push('Comment on the clinical significance of findings.')
    }
    if (agentLogic.clinical.suggest_follow_up) {
      instructions.push('Suggest appropriate follow-up when indicated.')
    }
    if (agentLogic.clinical.include_acuity) {
      instructions.push('Specify whether findings are acute, chronic, or acute-on-chronic when determinable.')
    }
    if (agentLogic.clinical.management_implications) {
      instructions.push('Include management implications for significant findings.')
    }
  }
  
  // Measurement handling in impressions
  if (agentLogic.measurements) {
    if (agentLogic.measurements.include_key_measurements_only) {
      instructions.push('Include only the most clinically relevant measurements in the impression.')
    }
    if (agentLogic.measurements.describe_change_from_prior) {
      instructions.push('When prior studies are mentioned, describe interval change.')
    }
  }
  
  // Severity and urgency
  if (agentLogic.severity) {
    if (agentLogic.severity.highlight_urgent_findings) {
      instructions.push('Highlight any urgent or emergent findings at the beginning of the impression.')
    }
    if (agentLogic.severity.use_standard_terminology) {
      instructions.push('Use standardized terminology for describing severity and urgency.')
    }
  }
  
  // Style preferences for impressions
  if (agentLogic.style) {
    if (agentLogic.style.definitive_statements) {
      instructions.push('Use definitive statements when findings are clear, avoid excessive hedging.')
    }
    if (agentLogic.style.active_voice) {
      instructions.push('Use active voice when possible.')
    }
    if (agentLogic.style.professional_tone) {
      instructions.push('Maintain a professional, objective tone.')
    }
  }
  
  // Anatomy-specific impression rules
  if (agentLogic.anatomy) {
    if (agentLogic.anatomy.group_related_findings) {
      instructions.push('Group related anatomical findings together in the impression.')
    }
    if (agentLogic.anatomy.mention_normal_variants) {
      instructions.push('Briefly mention significant normal variants that may cause confusion.')
    }
  }
  
  // Custom impression instructions
  if (agentLogic.custom_impression_instructions) {
    if (Array.isArray(agentLogic.custom_impression_instructions)) {
      instructions.push(...agentLogic.custom_impression_instructions)
    } else if (typeof agentLogic.custom_impression_instructions === 'string') {
      instructions.push(agentLogic.custom_impression_instructions)
    }
  }
  
  // Add all instructions to the prompt
  if (instructions.length > 0) {
    console.log(`🔍 Generated ${instructions.length} impression instructions from agent_logic:`, instructions)
    prompt += 'Instructions:\n'
    instructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  } else {
    console.log('⚠️ No impression instructions generated from agent_logic')
  }
  
  // Add examples specific to impressions if provided
  if (agentLogic.impression_examples && Array.isArray(agentLogic.impression_examples)) {
    prompt += 'Impression Examples:\n'
    agentLogic.impression_examples.forEach((example: any, index: number) => {
      prompt += `Example ${index + 1}:\n`
      if (example.findings) {
        prompt += `Findings: ${example.findings}\n`
      }
      if (example.impression) {
        prompt += `Impression: ${example.impression}\n`
      }
      prompt += '\n'
    })
  }
  
  // Final instruction
  prompt += 'Generate only the IMPRESSION section based on the findings and instructions provided above.'
  
  return prompt
}