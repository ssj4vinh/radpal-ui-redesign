import { StandardizedAgentLogic } from '../src/utils/standardizedLogicSchema'

/**
 * Build GPT prompt using the new standardized logic schema
 */
export default function buildStandardizedPrompt(
  findings: string,
  template: string,
  agentLogic: StandardizedAgentLogic,
  globalBasePrompt?: string | null
): string {
  console.log('🔍 Building prompt with standardized logic v3.0');
  
  // Use global base prompt from DB if available, otherwise use hardcoded default
  let prompt = globalBasePrompt || 'You are an expert radiologist generating a comprehensive radiology report.\n\n';
  
  // Add template if provided
  if (template) {
    prompt += 'TEMPLATE STRUCTURE - You MUST follow this exact structure:\n\n';
    prompt += template + '\n\n';
    prompt += 'IMPORTANT: Preserve ALL section headers EXACTLY as shown above.\n\n';
  }
  
  // Add findings
  prompt += 'IMPORTANT: The following imaging findings MUST be incorporated:\n\n';
  prompt += '=== FINDINGS TO INCORPORATE ===\n';
  prompt += findings + '\n';
  prompt += '=== END OF FINDINGS ===\n\n';
  
  const instructions: string[] = [];
  
  // GENERAL Category Instructions
  if (agentLogic.general) {
    // Corrections
    if (agentLogic.general.corrections?.enabled && agentLogic.general.corrections.rules?.length > 0) {
      for (const rule of agentLogic.general.corrections.rules) {
        instructions.push(`Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`);
      }
    }
    
    // Tone
    if (agentLogic.general.tone?.style) {
      switch (agentLogic.general.tone.style) {
        case 'definitive':
          instructions.push('Use definitive language throughout the report. When findings are clear, use direct terms like "demonstrates", "shows", "is", and "confirms". State diagnoses with confidence when imaging findings support them.');
          break;
        case 'cautious':
          instructions.push('Maintain a cautious tone throughout the report. Avoid making definitive diagnoses; instead suggest possibilities using terms like "suggests", "likely represents", "appears to be", "may indicate", and "is concerning for". Present findings as observations rather than conclusions.');
          break;
        case 'balanced':
          instructions.push('Maintain a balanced tone between cautious and definitive language. Use definitive terms for clear, unambiguous findings (e.g., "demonstrates a fracture") and cautious terms for uncertain or differential findings (e.g., "likely represents", "suggests"). Match the certainty of your language to the certainty of the imaging findings.');
          break;
      }
    }
    
    // Allowed sections
    if (agentLogic.general.allowed_sections?.enabled && agentLogic.general.allowed_sections.sections?.length > 0) {
      instructions.push(`Only include these sections: ${agentLogic.general.allowed_sections.sections.join(', ')}`);
    }
    
    // Disallowed symbols
    if (agentLogic.general.disallowed_symbols?.enabled && agentLogic.general.disallowed_symbols.symbols?.length > 0) {
      instructions.push(`Do not use these symbols: ${agentLogic.general.disallowed_symbols.symbols.join(', ')}`);
    }
    
    // Disallowed items
    if (agentLogic.general.disallowed_items?.enabled && agentLogic.general.disallowed_items.items?.length > 0) {
      instructions.push(`Do not include: ${agentLogic.general.disallowed_items.items.join(', ')}`);
    }
  }
  
  // REPORT Category Instructions
  if (agentLogic.report) {
    // Formatting
    if (agentLogic.report.formatting) {
      if (agentLogic.report.formatting.use_bullet_points) {
        instructions.push('Use bullet points for listing findings within sections');
      }
      if (agentLogic.report.formatting.preserve_template_punctuation) {
        instructions.push('Preserve all punctuation and formatting exactly as shown in the template');
      }
      if (agentLogic.report.formatting.prevent_unnecessary_capitalization) {
        instructions.push('Avoid unnecessary capitalization except for section headers');
      }
      if (agentLogic.report.formatting.preserve_spacing_and_capitalization) {
        instructions.push('Preserve exact spacing and capitalization from the template');
      }
    }
    
    // Language
    if (agentLogic.report.language) {
      if (agentLogic.report.language.avoid_words?.enabled && agentLogic.report.language.avoid_words.words?.length > 0) {
        instructions.push(`Avoid these words: ${agentLogic.report.language.avoid_words.words.join(', ')}`);
      }
      if (agentLogic.report.language.avoid_phrases?.enabled && agentLogic.report.language.avoid_phrases.phrases?.length > 0) {
        instructions.push(`Avoid these phrases: ${agentLogic.report.language.avoid_phrases.phrases.join(', ')}`);
      }
      if (agentLogic.report.language.expand_lesion_descriptions) {
        instructions.push('When the user describes a lesion finding without providing detailed imaging characteristics, please expand the description to include typical MRI or CT imaging features such as signal intensity/attenuation, margins (well-defined vs ill-defined), enhancement pattern, mass effect, and other relevant imaging characteristics commonly seen with such lesions. Add these descriptors naturally as would be typical in a radiology report.');
      }
    }
  }
  
  // IMPRESSION Category Instructions
  if (agentLogic.impression) {
    // Format
    if (agentLogic.impression.format) {
      switch (agentLogic.impression.format.style) {
        case 'numerically_itemized':
          instructions.push('IMPRESSION FORMAT: Use numbered list (1, 2, 3, etc.)');
          break;
        case 'bullet_points':
          instructions.push('IMPRESSION FORMAT: Use bullet points (• ) for each item');
          break;
        case 'none':
          instructions.push('IMPRESSION FORMAT: Write as continuous prose without bullets or numbers');
          break;
      }
      
      if (agentLogic.impression.format.spacing === 'double') {
        instructions.push('Use double spacing between impression items');
      } else {
        instructions.push('Use single spacing between impression items');
      }
    }
    
    // Exclude by default
    if (agentLogic.impression.exclude_by_default && agentLogic.impression.exclude_by_default.length > 0) {
      const readableExclusions = agentLogic.impression.exclude_by_default.map(item => 
        item.replace(/_/g, ' ').toLowerCase()
      );
      instructions.push(`Do not include these in the impression unless clinically significant: ${readableExclusions.join(', ')}`);
    }
  }
  
  // Custom instructions (preserved from migration)
  if (agentLogic.custom_instructions && agentLogic.custom_instructions.length > 0) {
    instructions.push('=== CUSTOM INSTRUCTIONS ===');
    instructions.push(...agentLogic.custom_instructions);
  }
  
  // Add critical rules section first (before other instructions)
  prompt += '=== CRITICAL RULES ===\n';
  prompt += '• You must incorporate ALL findings provided above into the appropriate sections\n';
  prompt += '• The ONLY allowed sections are "Findings" and "Impression"\n';
  prompt += '• Do not add any other sections (no Technique, no Comparison, no Clinical Information, etc.)\n\n';
  
  // Add all other instructions to prompt
  if (instructions.length > 0) {
    prompt += 'ADDITIONAL INSTRUCTIONS:\n';
    instructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`;
    });
  }
  
  return prompt;
}