/**
 * Parse text-based global impression rules into structured format
 */
function parseGlobalImpressionRulesText(rulesInput: any): { 
  custom_rules: string[], 
  exclude_by_default?: any[],
  priority?: { high_priority_keywords?: string[], low_priority_keywords?: string[] }
} {
  // Handle various input formats
  let rulesText = '';
  if (typeof rulesInput === 'string') {
    rulesText = rulesInput;
  } else if (rulesInput?.text) {
    rulesText = rulesInput.text;
  } else if (rulesInput?.custom_rules || rulesInput?.exclude_by_default || rulesInput?.priority) {
    // Already in parsed format, return as is
    return rulesInput;
  }
  
  if (!rulesText) return { custom_rules: [] }
  
  console.log('📝 Parsing global impression rules text:', rulesText);
  
  const lines = rulesText.split('\n').filter(line => line.trim())
  const customRules: string[] = []
  const exclusions: any[] = []
  const highPriorityKeywords: string[] = []
  const lowPriorityKeywords: string[] = []
  
  let currentSection = 'general'
  
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim()
    // Skip empty lines and examples
    if (!trimmed || trimmed.startsWith('Example')) {
      console.log(`  Skipping line ${lineIndex}: empty or example`);
      return
    }
    
    // Detect section headers
    if (trimmed.match(/General Rules:/i)) {
      console.log(`  Line ${lineIndex}: Found General Rules header`);
      currentSection = 'general'
      return
    }
    if (trimmed.match(/Exclusions?.*:/i)) {
      console.log(`  Line ${lineIndex}: Found Exclusions header`);
      currentSection = 'exclusions'
      return
    }
    if (trimmed.match(/Priority Keywords?.*:/i) || trimmed.match(/findings to list first/i)) {
      console.log(`  Line ${lineIndex}: Found Priority Keywords header`);
      currentSection = 'priority'
      return
    }
    if (trimmed.match(/Custom Rules?:/i)) {
      console.log(`  Line ${lineIndex}: Found Custom Rules header`);
      currentSection = 'custom'
      return
    }
    
    // Remove bullet points and special characters if present
    // Handle various bullet point styles including special Unicode bullets
    const cleanLine = trimmed.replace(/^[•●○■□▪▫◆◇★☆→›»\-*]\s*/, '').trim()
    
    if (!cleanLine) {
      console.log(`  Skipping line ${lineIndex}: empty after cleaning`);
      return
    }
    
    console.log(`  Processing line ${lineIndex} in section '${currentSection}': ${cleanLine.substring(0, 50)}...`);
    
    // Process based on current section
    if (currentSection === 'exclusions') {
      // Parse exclusion rules - can have conditional "unless" clauses
      const unlessMatch = cleanLine.match(/(.+?)\s*\(unless\s+(.+?)\)/i)
      if (unlessMatch) {
        exclusions.push({ finding: unlessMatch[1].trim(), unless: unlessMatch[2].trim() })
      } else {
        exclusions.push(cleanLine)
      }
    } else if (currentSection === 'priority') {
      // Add to high priority keywords
      highPriorityKeywords.push(cleanLine.toLowerCase())
    } else {
      // Add as custom rule for general or custom sections
      console.log(`    Adding as custom rule: ${cleanLine}`);
      customRules.push(cleanLine)
    }
  })
  
  const result: any = { custom_rules: customRules }
  if (exclusions.length > 0) result.exclude_by_default = exclusions
  if (highPriorityKeywords.length > 0 || lowPriorityKeywords.length > 0) {
    result.priority = {}
    if (highPriorityKeywords.length > 0) result.priority.high_priority_keywords = highPriorityKeywords
    if (lowPriorityKeywords.length > 0) result.priority.low_priority_keywords = lowPriorityKeywords
  }
  
  console.log('📝 Parsed impression rules:', result);
  
  return result
}

/**
 * Intelligently combine base and study-specific rules for impression generation
 * The input agentLogic contains both base (general, impression) and study-specific (study_impression) sections
 */
function combineImpressionLogic(agentLogic: Record<string, any>): Record<string, any> {
  // Create a new combined object with base logic
  const combined: Record<string, any> = {};
  
  // Copy base sections
  if (agentLogic.general) {
    combined.general = JSON.parse(JSON.stringify(agentLogic.general));
  }
  if (agentLogic.impression) {
    combined.impression = JSON.parse(JSON.stringify(agentLogic.impression));
  }
  if (agentLogic.custom_instructions) {
    combined.custom_instructions = JSON.parse(JSON.stringify(agentLogic.custom_instructions));
  }
  
  // Merge study-specific impression rules into the base impression
  if (agentLogic.study_impression) {
    if (!combined.impression) combined.impression = {};
    
    // Combine exclude_by_default arrays
    if (agentLogic.study_impression.exclude_by_default) {
      if (!combined.impression.exclude_by_default) {
        combined.impression.exclude_by_default = [];
      }
      // Merge exclusions (don't deduplicate in case of conditional exclusions)
      combined.impression.exclude_by_default = [
        ...(combined.impression.exclude_by_default || []),
        ...agentLogic.study_impression.exclude_by_default
      ];
    }
    
    // Override or add study-specific impression settings
    if (agentLogic.study_impression.required_opening_phrase) {
      combined.impression.required_opening_phrase = agentLogic.study_impression.required_opening_phrase;
    }
    
    if (agentLogic.study_impression.priority) {
      // Merge priority lists
      if (!combined.impression.priority) {
        combined.impression.priority = {};
      }
      Object.keys(agentLogic.study_impression.priority).forEach(key => {
        if (Array.isArray(agentLogic.study_impression.priority[key])) {
          combined.impression.priority[key] = [
            ...(combined.impression.priority[key] || []),
            ...agentLogic.study_impression.priority[key]
          ];
        }
      });
    }
    
    // Removed grouping_strategy and auto_reordering - no longer used
    
    // Combine custom impression rules
    if (agentLogic.study_impression.custom_rules) {
      if (!combined.impression.custom_rules) {
        combined.impression.custom_rules = [];
      }
      combined.impression.custom_rules = [
        ...(combined.impression.custom_rules || []),
        ...agentLogic.study_impression.custom_rules
      ];
    }
  }
  
  return combined;
}

export default function buildCombinedImpressionPrompt(
  findings: string,
  template: string,
  agentLogic: Record<string, any>,
  globalImpressionPrompt?: string,
  globalImpressionRules?: Record<string, any>
): string {
  console.log('🔍 BuildCombinedImpressionPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2))
  
  // The logic should already be merged from the IPC handler
  let combinedLogic = agentLogic;
  
  // The IPC handler returns merged logic with BOTH base sections AND study sections preserved
  // Only re-merge if we have study sections but NO base sections (old format)
  const hasOnlyStudySections = agentLogic.study_impression && 
                                !(agentLogic.general || agentLogic.impression);
  
  if (hasOnlyStudySections) {
    console.log('⚠️ Detected study-only impression logic (legacy format), needs merging');
    combinedLogic = combineImpressionLogic(agentLogic);
  } else {
    console.log('✅ Using pre-merged logic from IPC handler');
    // Log what we're using
    console.log('Impression logic structure:', {
      hasGeneral: !!combinedLogic.general,
      hasImpression: !!combinedLogic.impression,
      hasStudyImpression: !!combinedLogic.study_impression,
      impressionFormat: combinedLogic.impression?.format?.style,
      impressionSpacing: combinedLogic.impression?.format?.spacing,
      exclusionsCount: combinedLogic.impression?.exclude_by_default?.length || 0
    });
  }
  
  // Use global impression prompt from DB if available, otherwise use default
  let prompt = globalImpressionPrompt || 'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.'
  
  // Ensure there's proper spacing after the base prompt
  if (!prompt.endsWith('\n')) {
    prompt += '\n\n'
  } else if (!prompt.endsWith('\n\n')) {
    prompt += '\n'
  }
  
  // Add findings
  prompt += 'FINDINGS TO SUMMARIZE:\n\n'
  prompt += findings + '\n\n'
  
  // Build unified impression rules
  const impressionRules: string[] = [];
  const formattingRules: string[] = [];
  const contentRules: string[] = [];
  
  console.log('🔨 Initializing rule arrays for impression prompt');
  
  // Process general rules if applicable
  if (combinedLogic.general) {
    // Add general corrections that apply to impressions too
    if (combinedLogic.general.corrections?.rules && combinedLogic.general.corrections.rules.length > 0) {
      combinedLogic.general.corrections.rules.forEach(rule => {
        if (rule.find && rule.replace) {
          contentRules.push(`Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`);
        }
      });
    }
    
    if (combinedLogic.general.tone?.style) {
      contentRules.push(`Maintain a ${combinedLogic.general.tone.style} tone`);
    }
    
    if (combinedLogic.general.disallowed_items) {
      const items = Object.entries(combinedLogic.general.disallowed_items)
        .filter(([_, value]) => value)
        .map(([key, _]) => key.replace(/_/g, ' '));
      if (items.length > 0) {
        contentRules.push(`Do NOT include: ${items.join(', ')}`);
      }
    }
  }
  
  // Global impression rules are now handled via the function parameter and inserted in the appropriate section
  
  // Process impression-specific rules
  if (combinedLogic.impression) {
    // Format rules - HIGHEST PRIORITY
    if (combinedLogic.impression.format?.style === 'numerically_itemized') {
      formattingRules.push('MANDATORY: The impression should be formatted as a short numbered list, but closely related findings (e.g., osteoarthritis + meniscal tear in the same compartment) should be combined into one item.');
      if (combinedLogic.impression.format?.spacing === 'double') {
        formattingRules.push('Each numbered item should be on its own line with DOUBLE spacing between items');
      } else {
        formattingRules.push('Each numbered item should be on its own line with single spacing between items');
      }
    } else if (combinedLogic.impression.format?.style === 'bullet_points') {
      formattingRules.push('MANDATORY: Format as bullet points using • symbols');
      if (combinedLogic.impression.format?.spacing === 'double') {
        formattingRules.push('Each bullet point should be on its own line with DOUBLE spacing between items');
      } else {
        formattingRules.push('Each bullet point should be on its own line with single spacing between items');
      }
    } else if (combinedLogic.impression.format?.style === 'paragraph' || combinedLogic.impression.format?.style === 'none') {
      formattingRules.push('Format as prose paragraphs, not as a list');
      formattingRules.push('Separate distinct findings with appropriate punctuation');
    }
    
    // Insert global impression rules after format rules
    if (globalImpressionRules) {
      console.log('🌍 Processing global impression rules for standalone impression:', globalImpressionRules);
      
      // Parse text-based rules if needed
      const parsedRules = typeof globalImpressionRules === 'string' || globalImpressionRules?.text
        ? parseGlobalImpressionRulesText(globalImpressionRules?.text || globalImpressionRules)
        : globalImpressionRules;
      
      console.log('🌍 Parsed global impression rules:', parsedRules);
      
      // Add global custom impression rules
      if (parsedRules.custom_rules && parsedRules.custom_rules.length > 0) {
        console.log(`🌍 Adding ${parsedRules.custom_rules.length} global impression rules`);
        parsedRules.custom_rules.forEach((rule: string) => {
          console.log(`  - Adding global impression rule: ${rule}`);
          impressionRules.push(rule);
        });
      }
    }
    
    // Exclusion rules with conditional logic support
    if (combinedLogic.impression.exclude_by_default && combinedLogic.impression.exclude_by_default.length > 0) {
      impressionRules.push('');
      impressionRules.push('Do not mention these findings in the impression:');
      
      combinedLogic.impression.exclude_by_default.forEach((exclusion: any) => {
        if (typeof exclusion === 'string') {
          // Simple string exclusion (backward compatibility)
          const readable = exclusion.replace(/_/g, ' ').toLowerCase();
          impressionRules.push(`• ${readable}`);
        } else if (exclusion && typeof exclusion === 'object') {
          // Conditional exclusion object
          let rule = `• ${exclusion.finding}`;
          if (exclusion.unless) {
            rule += ` UNLESS ${exclusion.unless}`;
          }
          impressionRules.push(rule);
        }
      });
      
      impressionRules.push('');
    }
    
    // Opening phrase requirement
    if (combinedLogic.impression.required_opening_phrase?.enabled && combinedLogic.impression.required_opening_phrase?.phrase) {
      impressionRules.push(`REQUIRED: The first impression item MUST begin with: "${combinedLogic.impression.required_opening_phrase.phrase}"`);
    }
    
    // Priority ordering
    if (combinedLogic.impression.priority) {
      const priorityRules: string[] = [];
      
      if (combinedLogic.impression.priority.high_priority_findings?.length > 0) {
        priorityRules.push(`List these findings FIRST if present: ${combinedLogic.impression.priority.high_priority_findings.join(', ')}`);
      }
      
      if (combinedLogic.impression.priority.high_priority_keywords?.length > 0) {
        priorityRules.push(`Prioritize findings containing these keywords: ${combinedLogic.impression.priority.high_priority_keywords.join(', ')}`);
      }
      
      if (combinedLogic.impression.priority.low_priority_findings?.length > 0) {
        priorityRules.push(`List these findings LAST if included: ${combinedLogic.impression.priority.low_priority_findings.join(', ')}`);
      }
      
      if (priorityRules.length > 0) {
        impressionRules.push('FINDING PRIORITY ORDER:');
        priorityRules.forEach(rule => impressionRules.push(`- ${rule}`));
      }
    }
    
    // Removed grouping strategy - no longer configurable
    
    // General impression guidelines
    contentRules.push('Prioritize findings that may require intervention, additional imaging, or result in significant pain');
    contentRules.push('Be concise - avoid redundant descriptions');
    contentRules.push('Use standard medical terminology');
    
    if (combinedLogic.impression.include_recommendations) {
      contentRules.push('Include follow-up recommendations when appropriate');
    }
    
    if (combinedLogic.impression.differential_diagnosis) {
      contentRules.push('Provide differential diagnoses for ambiguous findings');
    }
    
    // Custom rules
    if (combinedLogic.impression.custom_rules && combinedLogic.impression.custom_rules.length > 0) {
      combinedLogic.impression.custom_rules.forEach((rule: string) => {
        contentRules.push(rule);
      });
    }
  }
  
  // Add custom instructions
  const customInstructions: string[] = [];
  if (combinedLogic.custom_instructions) {
    if (Array.isArray(combinedLogic.custom_instructions)) {
      customInstructions.push(...combinedLogic.custom_instructions);
    } else if (typeof combinedLogic.custom_instructions === 'string') {
      customInstructions.push(combinedLogic.custom_instructions);
    }
  }
  
  // Build the final prompt with unified sections
  if (formattingRules.length > 0) {
    prompt += 'FORMATTING REQUIREMENTS:\n'
    formattingRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
    prompt += '\n'
  }
  
  if (impressionRules.length > 0) {
    prompt += 'IMPRESSION SECTION RULES:\n'
    let ruleIndex = 1;
    impressionRules.forEach((rule) => {
      // Handle exclusion section and empty lines specially
      if (rule === '' || rule === 'Do not mention these findings in the impression:' || rule.startsWith('•')) {
        prompt += `${rule}\n`
      } else {
        prompt += `${ruleIndex}. ${rule}\n`
        ruleIndex++;
      }
    })
    prompt += '\n'
  }
  
  if (contentRules.length > 0) {
    prompt += 'GENERAL GUIDELINES:\n'
    contentRules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`
    })
    prompt += '\n'
  }
  
  if (customInstructions.length > 0) {
    prompt += 'ADDITIONAL INSTRUCTIONS:\n'
    customInstructions.forEach((instruction, index) => {
      prompt += `${index + 1}. ${instruction}\n`
    })
    prompt += '\n'
  }
  
  // Skip template for impression generation - template is only for full report generation
  // The impression should be generated based on findings and logic rules only
  
  console.log('🎯 Combined impression prompt generated with unified rules')
  console.log(`Rules breakdown - Formatting: ${formattingRules.length}, Impression: ${impressionRules.length}, Content: ${contentRules.length}, Custom: ${customInstructions.length}`)
  
  // Debug: Log the actual content rules to verify global rules are included
  if (contentRules.length > 0) {
    console.log('📋 CONTENT RULES in impression prompt:');
    contentRules.forEach((rule, index) => {
      console.log(`  ${index + 1}. ${rule}`);
    });
  }
  
  // Debug: Show a snippet of the final prompt
  const promptLines = prompt.split('\n');
  const generalGuidelinesIndex = promptLines.findIndex(line => line.includes('GENERAL GUIDELINES:'));
  if (generalGuidelinesIndex > -1) {
    console.log('📋 GENERAL GUIDELINES section in final prompt:');
    for (let i = generalGuidelinesIndex; i < Math.min(generalGuidelinesIndex + 15, promptLines.length); i++) {
      console.log(promptLines[i]);
    }
  }
  
  return prompt
}