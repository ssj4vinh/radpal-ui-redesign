import { AgentLogic } from './types'

// For backward compatibility, accept either merged logic or raw logic
export default function buildPrompt(
  findings: string,
  template: string,
  agentLogic: Record<string, any>
): string {
  // Debug: Log the full agent logic structure
  console.log('🔍 BuildPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2))
  
  // Check if this is V2 logic (has version and new structure)
  const isV2Logic = agentLogic.version === "3.0" || (agentLogic.general && agentLogic.report && agentLogic.impression)
  
  if (isV2Logic) {
    console.log('✅ Using V2 logic structure in buildPrompt')
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
  
  // Add template if provided
  if (template) {
    prompt += 'TEMPLATE STRUCTURE - You MUST follow this exact structure:\n\n'
    prompt += template + '\n\n'
    prompt += 'IMPORTANT: Preserve ALL section headers (text ending with ":") EXACTLY as shown above. Do not add, remove, or modify any section headers.\n\n'
  }
  
// Add findings with emphasis
prompt += 'IMPORTANT: The following imaging findings have been identified and MUST be incorporated into the report. Do not omit any findings:\n\n'
prompt += '=== FINDINGS TO INCORPORATE ===\n'
prompt += findings + '\n'
prompt += '=== END OF FINDINGS ===\n\n'

  
  // Build instructions based on agent logic
  const instructions: string[] = []
  
  // Formatting instructions
  if (agentLogic.formatting) {
    if (agentLogic.formatting.preserve_template_punctuation) {
      instructions.push('Preserve all punctuation and formatting exactly as shown in the template.')
    }
    if (agentLogic.formatting.use_bullet_points) {
      instructions.push('Use bullet points for listing multiple findings within each section.')
    }
    if (agentLogic.formatting.capitalize_sections) {
      instructions.push('Ensure all section headers are in UPPERCASE.')
    }
  }
  
  // Report-specific instructions
  if (agentLogic.report) {
    if (agentLogic.report.no_hallucinated_findings) {
      instructions.push('Do not invent findings. Only report what is explicitly stated in the findings.')
    }
    // Always add this instruction to ensure findings are incorporated
    instructions.push('CRITICAL: You must incorporate ALL the findings provided between the "=== FINDINGS TO INCORPORATE ===" markers into the appropriate sections of the report. Do not omit any findings.')
    
    // Add strict section header enforcement
    instructions.push('SECTION HEADERS: You MUST preserve ALL section headers exactly as shown in the template (e.g., FINDINGS:, IMPRESSION:, etc.). Do not add, remove, or modify any section headers.')
    instructions.push('SECTION CONTENT: While section headers must be preserved exactly, the content within each section can be written in a natural, fluid manner based on the findings provided.')
    if (agentLogic.report.include_technique_section) {
      instructions.push('Include a TECHNIQUE section describing the imaging protocol used.')
    }
    if (agentLogic.report.include_comparison) {
      instructions.push('Include a COMPARISON section if prior imaging is mentioned.')
    }
    if (agentLogic.report.use_medical_abbreviations) {
      instructions.push('Use standard medical abbreviations where appropriate.')
    }
    if (agentLogic.report.expand_lesions) {
      instructions.push('For each lesion, describe location, size, morphology, and enhancement characteristics.')
    }
    
    // Handle cartilage placement rules
    if (agentLogic.report.cartilage_placement) {
      if (agentLogic.report.cartilage_placement.trochlear_cartilage_in_patellofemoral) {
        instructions.push('Ensure trochlear cartilage findings are included in the patellofemoral compartment.')
      }
      if (agentLogic.report.cartilage_placement.mention_patellar_if_trochlear_defect_present) {
        instructions.push('If a trochlear defect is present, confirm that the patellar cartilage is explicitly stated as intact or abnormal.')
      }
    }
    
    // Handle anatomic routing rules
    if (agentLogic.report.anatomic_routing_rules) {
      console.log('🔍 Processing anatomic_routing_rules:', agentLogic.report.anatomic_routing_rules)
      
      if (agentLogic.report.anatomic_routing_rules.loose_bodies === 'joints') {
        instructions.push('Describe loose bodies under the joints section.')
      }
      if (agentLogic.report.anatomic_routing_rules.bone_contusions === 'ossea_or_bone_marrow') {
        instructions.push('Describe bone contusions under the osseous structures or bone marrow section.')
      }
      if (agentLogic.report.anatomic_routing_rules.joint_effusions === 'joint_space') {
        instructions.push('Describe joint effusions under the joint space section.')
      }
    }
  }
  
  // Impression-specific instructions
  if (agentLogic.impression) {
    if (agentLogic.impression.numerically_itemized) {
      instructions.push('IMPRESSION FORMAT: Write the impression section as a numbered list (1, 2, 3, etc.).')
    }
    // Additional impression formatting is already handled above
    if (agentLogic.impression.omit_minor_or_incidental_findings_unless_relevant) {
      instructions.push('In the impression, omit mild or incidental findings unless relevant to the clinical history.')
    }
    if (agentLogic.impression.concise_summary) {
      instructions.push('Keep the impression concise, focusing on clinically significant findings.')
    }
    if (agentLogic.impression.include_recommendations) {
      instructions.push('Include follow-up recommendations when appropriate.')
    }
    if (agentLogic.impression.differential_diagnosis) {
      instructions.push('Provide differential diagnoses for significant findings when appropriate.')
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
      }
    }
  }
  
  // Anatomy-specific instructions
  if (agentLogic.anatomy) {
    if (agentLogic.anatomy.combine_meniscus_and_cartilage_findings) {
      instructions.push('Combine meniscus and cartilage findings in the same section for better organization.')
    }
    if (agentLogic.anatomy.group_by_anatomic_region) {
      instructions.push('Group findings by anatomic region (e.g., anterior, posterior, medial, lateral).')
    }
    if (agentLogic.anatomy.describe_bilateral_structures) {
      instructions.push('For bilateral structures, describe each side separately and note any asymmetry.')
    }
  }
  
  // Clinical correlation instructions
  if (agentLogic.clinical) {
    if (agentLogic.clinical.correlate_with_symptoms) {
      instructions.push('Correlate findings with clinical symptoms when provided.')
    }
    if (agentLogic.clinical.mention_clinical_significance) {
      instructions.push('Comment on the clinical significance of major findings.')
    }
  }
  
  // Measurement and quantification instructions
  if (agentLogic.measurements) {
    if (agentLogic.measurements.include_all_measurements) {
      instructions.push('Include all measurements mentioned in the findings.')
    }
    if (agentLogic.measurements.use_metric_system) {
      instructions.push('Use metric system (mm, cm) for all measurements.')
    }
    if (agentLogic.measurements.describe_change_from_prior) {
      instructions.push('When prior measurements are available, describe interval change.')
    }
  }
  
  // Severity and grading instructions
  if (agentLogic.severity) {
    if (agentLogic.severity.use_standard_grading) {
      instructions.push('Use standard grading systems (e.g., mild/moderate/severe) consistently.')
    }
    if (agentLogic.severity.avoid_vague_terms) {
      instructions.push('Avoid vague terms like "some" or "several" - be specific.')
    }
  }
  
  // Style preferences
  if (agentLogic.style) {
    if (agentLogic.style.active_voice) {
      instructions.push('Use active voice when describing findings.')
    }
    if (agentLogic.style.avoid_hedging) {
      instructions.push('Avoid excessive hedging language unless uncertainty is clinically relevant.')
    }
    if (agentLogic.style.professional_tone) {
      instructions.push('Maintain a professional, objective tone throughout.')
    }
  }
  
  // Add custom instructions if provided
  if (agentLogic.custom_instructions) {
    if (Array.isArray(agentLogic.custom_instructions)) {
      instructions.push(...agentLogic.custom_instructions)
    } else if (typeof agentLogic.custom_instructions === 'string') {
      instructions.push(agentLogic.custom_instructions)
    }
  }
  
  // Add all instructions to the prompt
  if (instructions.length > 0) {
    console.log(`🔍 Generated ${instructions.length} instructions from agent_logic:`, instructions)
    prompt += 'Instructions:\n'
    instructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  } else {
    console.log('⚠️ No instructions generated from agent_logic')
  }
  
  // Add specific examples if provided
  if (agentLogic.examples && Array.isArray(agentLogic.examples)) {
    prompt += 'Examples:\n'
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
  
  // Final instruction
  prompt += 'Generate a complete radiology report following these requirements:\n'
  prompt += '1. Use the EXACT section headers from the template (preserve all text ending with ":")\n'
  prompt += '2. Fill each section with appropriate content based on the findings provided\n'
  prompt += '3. Incorporate ALL findings from the "=== FINDINGS TO INCORPORATE ===" section\n'
  prompt += '4. Write fluid, natural content within each section while maintaining clinical accuracy\n'
  prompt += '5. Do NOT add, remove, or modify any section headers from the template\n'
  if (agentLogic.impression?.numerically_itemized) {
    prompt += '6. Format the IMPRESSION section as a numbered list (1, 2, 3, etc.)\n'
  } else {
    prompt += '6. Write the IMPRESSION section in paragraph form with clear, concise statements\n'
  }
  
  return prompt
}