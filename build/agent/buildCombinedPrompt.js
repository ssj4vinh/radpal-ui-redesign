"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = buildCombinedPrompt;
/**
 * Intelligently combine base and study-specific rules into unified sections
 * The input agentLogic contains both base (general, report, impression) and study-specific (study_report, study_impression) sections
 */
function combineLogicRules(agentLogic) {
    // Create a new combined object with base logic
    const combined = {};
    // Copy base sections
    if (agentLogic.general) {
        combined.general = JSON.parse(JSON.stringify(agentLogic.general));
    }
    if (agentLogic.report) {
        combined.report = JSON.parse(JSON.stringify(agentLogic.report));
    }
    if (agentLogic.impression) {
        combined.impression = JSON.parse(JSON.stringify(agentLogic.impression));
    }
    if (agentLogic.custom_instructions) {
        combined.custom_instructions = JSON.parse(JSON.stringify(agentLogic.custom_instructions));
    }
    // Merge study-specific report rules into the base report
    if (agentLogic.study_report) {
        if (!combined.report)
            combined.report = {};
        // Combine corrections
        if (agentLogic.study_report.corrections?.rules) {
            if (!combined.report.corrections) {
                combined.report.corrections = { rules: [] };
            }
            combined.report.corrections.rules = [
                ...(combined.report.corrections?.rules || []),
                ...agentLogic.study_report.corrections.rules
            ];
        }
        // Add anatomic routing rules (these are study-specific only)
        if (agentLogic.study_report.anatomic_routing_rules) {
            combined.report.anatomic_routing_rules = agentLogic.study_report.anatomic_routing_rules;
        }
        // Combine custom rules
        if (agentLogic.study_report.custom_rules) {
            if (!combined.report.custom_rules) {
                combined.report.custom_rules = [];
            }
            combined.report.custom_rules = [
                ...(combined.report.custom_rules || []),
                ...agentLogic.study_report.custom_rules
            ];
        }
    }
    // Merge study-specific impression rules into the base impression
    if (agentLogic.study_impression) {
        if (!combined.impression)
            combined.impression = {};
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
        if (agentLogic.study_impression.grouping_strategy) {
            combined.impression.grouping_strategy = agentLogic.study_impression.grouping_strategy;
        }
        if (agentLogic.study_impression.auto_reordering !== undefined) {
            combined.impression.auto_reordering = agentLogic.study_impression.auto_reordering;
        }
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
function buildCombinedPrompt(findings, template, agentLogic) {
    console.log('🔍 BuildCombinedPrompt received agent_logic:', JSON.stringify(agentLogic, null, 2));
    // The logic should already be merged from the IPC handler
    let combinedLogic = agentLogic;
    // The IPC handler returns merged logic with BOTH base sections AND study sections preserved
    // We should NOT re-merge if we already have the merged structure
    // Only re-merge if we have study sections but NO base sections (old format)
    const hasOnlyStudySections = (agentLogic.study_report || agentLogic.study_impression) &&
        !(agentLogic.general || agentLogic.report || agentLogic.impression);
    if (hasOnlyStudySections) {
        console.log('⚠️ Detected study-only logic (legacy format), needs merging');
        combinedLogic = combineLogicRules(agentLogic);
    }
    else {
        console.log('✅ Using pre-merged logic from IPC handler');
        // Log what we're using
        console.log('Logic structure:', {
            hasGeneral: !!combinedLogic.general,
            hasReport: !!combinedLogic.report,
            hasImpression: !!combinedLogic.impression,
            hasStudyReport: !!combinedLogic.study_report,
            hasStudyImpression: !!combinedLogic.study_impression,
            generalCorrections: combinedLogic.general?.corrections?.rules?.length || 0,
            reportCorrections: combinedLogic.report?.corrections?.rules?.length || 0,
            impressionFormat: combinedLogic.impression?.format?.style,
            impressionSpacing: combinedLogic.impression?.format?.spacing
        });
    }
    // Start with the base instruction
    let prompt = 'You are an expert radiologist generating a comprehensive radiology report.\n\n';
    // Add template if provided with strong enforcement
    if (template) {
        prompt += 'TEMPLATE STRUCTURE - MANDATORY COMPLIANCE:\n\n';
        prompt += template + '\n\n';
        prompt += 'CRITICAL: Preserve ALL section headers (text ending with ":") EXACTLY as shown above. Any deviation from the template structure will be considered an error.\n\n';
        prompt += 'CRITICAL SPACING RULE: Always include a space after colons in section headers (e.g., "Neurovascular structures: Unremarkable" NOT "Neurovascular structures:Unremarkable"). This spacing is mandatory and must be preserved exactly as shown in the template.\n\n';
    }
    // Add findings with maximum emphasis
    prompt += 'MANDATORY FINDINGS INCORPORATION:\n\n';
    prompt += '=== FINDINGS TO INCORPORATE ===\n';
    prompt += findings + '\n';
    prompt += '=== END OF FINDINGS ===\n\n';
    prompt += 'CRITICAL REQUIREMENT: Every single finding above MUST appear in the appropriate section of your report. Omitting any finding is unacceptable.\n\n';
    // Build unified sections for rules
    const findingsRules = [];
    const impressionRules = [];
    const generalRules = [];
    // Process general rules
    if (combinedLogic.general) {
        if (combinedLogic.general.tone?.style) {
            generalRules.push(`Maintain a ${combinedLogic.general.tone.style} tone throughout the report`);
        }
        if (combinedLogic.general.disallowed_items) {
            const items = Object.entries(combinedLogic.general.disallowed_items)
                .filter(([_, value]) => value)
                .map(([key, _]) => key.replace(/_/g, ' '));
            if (items.length > 0) {
                generalRules.push(`Do NOT include: ${items.join(', ')}`);
            }
        }
        if (combinedLogic.general.disallowed_symbols?.enabled && combinedLogic.general.disallowed_symbols?.symbols) {
            generalRules.push(`Do NOT use these symbols: ${combinedLogic.general.disallowed_symbols.symbols.join(', ')}`);
        }
    }
    // Process GENERAL corrections first (base logic)
    if (combinedLogic.general?.corrections?.rules && combinedLogic.general.corrections.rules.length > 0) {
        combinedLogic.general.corrections.rules.forEach(rule => {
            if (rule.find && rule.replace) {
                findingsRules.push(`Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`);
            }
        });
    }
    // Process findings/report section rules
    if (combinedLogic.report) {
        // Study-specific word corrections (from report section)
        if (combinedLogic.report.corrections?.rules && combinedLogic.report.corrections.rules.length > 0) {
            combinedLogic.report.corrections.rules.forEach(rule => {
                if (rule.find && rule.replace) {
                    findingsRules.push(`Replace "${rule.find}" with "${rule.replace}"${rule.description ? ` (${rule.description})` : ''}`);
                }
            });
        }
        if (combinedLogic.report.formatting) {
            if (combinedLogic.report.formatting.preserve_template_punctuation) {
                // Modified rules for more natural phrasing while keeping structure
                findingsRules.push('Preserve section headers EXACTLY as shown (including punctuation and spacing)');
                findingsRules.push('Within each section, prioritize natural clinical phrasing over template wording');
                findingsRules.push('When pathology is present, describe it directly without awkwardly negating template phrases');
                findingsRules.push('Omit template phrases that become redundant when combined with pathologic findings');
            }
            if (combinedLogic.report.formatting.use_bullet_points) {
                findingsRules.push('Use bullet points for listing multiple findings within each section');
            }
            if (combinedLogic.report.formatting.prevent_unnecessary_capitalization) {
                findingsRules.push('Avoid unnecessary capitalization - use standard case unless specified');
            }
        }
        if (combinedLogic.report.language) {
            if (combinedLogic.report.language.avoid_words?.enabled && combinedLogic.report.language.avoid_words?.words?.length > 0) {
                findingsRules.push(`Avoid using these words: ${combinedLogic.report.language.avoid_words.words.join(', ')}`);
            }
            if (combinedLogic.report.language.avoid_phrases?.enabled && combinedLogic.report.language.avoid_phrases?.phrases?.length > 0) {
                findingsRules.push(`Avoid these phrases: ${combinedLogic.report.language.avoid_phrases.phrases.join(', ')}`);
            }
            if (combinedLogic.report.language.expand_lesion_descriptions) {
                findingsRules.push('Expand lesion descriptions with location, size, morphology, and enhancement characteristics');
            }
        }
        // Add anatomic routing rules
        if (combinedLogic.report.anatomic_routing_rules) {
            // Handle both object format (from defaultAgentLogic) and array format (from LogicEditorV3)
            if (Array.isArray(combinedLogic.report.anatomic_routing_rules)) {
                // Array format from LogicEditorV3
                combinedLogic.report.anatomic_routing_rules.forEach((rule) => {
                    if (rule.condition && rule.route_to) {
                        findingsRules.push(`If finding contains "${rule.condition}", route to "${rule.route_to}" section`);
                    }
                });
            }
            else if (typeof combinedLogic.report.anatomic_routing_rules === 'object') {
                // Object format from defaultAgentLogic
                const rules = combinedLogic.report.anatomic_routing_rules;
                if (rules.loose_bodies === 'joints') {
                    findingsRules.push('Describe loose bodies under the joints section');
                }
                if (rules.bone_contusions === 'ossea_or_bone_marrow') {
                    findingsRules.push('Describe bone contusions under the osseous structures or bone marrow section');
                }
                if (rules.joint_effusions === 'joint_space') {
                    findingsRules.push('Describe joint effusions under the joint space section');
                }
                if (rules.group_pathology_by_type) {
                    findingsRules.push('Group similar pathology together by type');
                }
            }
        }
        // Add custom report rules
        if (combinedLogic.report.custom_rules && combinedLogic.report.custom_rules.length > 0) {
            combinedLogic.report.custom_rules.forEach((rule) => {
                findingsRules.push(rule);
            });
        }
        // Always add this critical rule
        findingsRules.push('Do not invent findings. Only report what is explicitly stated in the provided findings');
        findingsRules.push('Incorporate ALL findings from the "=== FINDINGS TO INCORPORATE ===" section');
    }
    // Process impression section rules
    if (combinedLogic.impression) {
        // Format rules
        if (combinedLogic.impression.format?.style === 'numerically_itemized') {
            impressionRules.push('Format the impression as a numbered list (1, 2, 3, etc.)');
            if (combinedLogic.impression.format?.spacing === 'double') {
                impressionRules.push('Use DOUBLE spacing between each numbered item');
            }
            else {
                impressionRules.push('Use single spacing between each numbered item');
            }
        }
        else if (combinedLogic.impression.format?.style === 'bullet_points') {
            impressionRules.push('Format the impression as a bullet point list using • symbols');
            if (combinedLogic.impression.format?.spacing === 'double') {
                impressionRules.push('Use DOUBLE spacing between each bullet point');
            }
            else {
                impressionRules.push('Use single spacing between each bullet point');
            }
        }
        else if (combinedLogic.impression.format?.style === 'none') {
            impressionRules.push('Format the impression as continuous prose without bullets or numbers');
        }
        // Exclusion rules with conditional logic support
        if (combinedLogic.impression.exclude_by_default && combinedLogic.impression.exclude_by_default.length > 0) {
            impressionRules.push('');
            impressionRules.push('Do not mention these findings in the impression:');
            combinedLogic.impression.exclude_by_default.forEach((exclusion) => {
                if (typeof exclusion === 'string') {
                    // Simple string exclusion (backward compatibility)
                    const readable = exclusion.replace(/_/g, ' ').toLowerCase();
                    impressionRules.push(`• ${readable}`);
                }
                else if (exclusion && typeof exclusion === 'object') {
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
        // Priority and ordering rules
        if (combinedLogic.impression.required_opening_phrase?.enabled && combinedLogic.impression.required_opening_phrase?.phrase) {
            impressionRules.push(`The first impression item MUST start with: "${combinedLogic.impression.required_opening_phrase.phrase}"`);
        }
        if (combinedLogic.impression.priority) {
            if (combinedLogic.impression.priority.high_priority_findings?.length > 0) {
                impressionRules.push(`High priority findings to list first: ${combinedLogic.impression.priority.high_priority_findings.join(', ')}`);
            }
        }
        if (combinedLogic.impression.grouping_strategy) {
            impressionRules.push(`Group impression items by: ${combinedLogic.impression.grouping_strategy}`);
        }
        // General impression guidelines
        impressionRules.push('Focus on clinically significant findings');
        impressionRules.push('Omit incidental findings unless relevant to clinical history');
        impressionRules.push('Keep the impression concise and actionable');
        // Add custom impression rules
        if (combinedLogic.impression.custom_rules && combinedLogic.impression.custom_rules.length > 0) {
            combinedLogic.impression.custom_rules.forEach((rule) => {
                impressionRules.push(rule);
            });
        }
    }
    // Add custom instructions
    const customInstructions = [];
    if (combinedLogic.custom_instructions) {
        if (Array.isArray(combinedLogic.custom_instructions)) {
            customInstructions.push(...combinedLogic.custom_instructions);
        }
        else if (typeof combinedLogic.custom_instructions === 'string') {
            customInstructions.push(combinedLogic.custom_instructions);
        }
    }
    // Build the final prompt with unified sections
    if (generalRules.length > 0) {
        prompt += 'GENERAL REQUIREMENTS:\n';
        generalRules.forEach((rule, index) => {
            prompt += `${index + 1}. ${rule}\n`;
        });
        prompt += '\n';
    }
    if (findingsRules.length > 0) {
        prompt += 'FINDINGS SECTION RULES:\n';
        findingsRules.forEach((rule, index) => {
            prompt += `${index + 1}. ${rule}\n`;
        });
        prompt += '\n';
    }
    if (impressionRules.length > 0) {
        prompt += 'IMPRESSION SECTION RULES:\n';
        let ruleIndex = 1;
        impressionRules.forEach((rule) => {
            // Handle exclusion section and empty lines specially
            if (rule === '' || rule === 'Do not mention these findings in the impression:' || rule.startsWith('•')) {
                prompt += `${rule}\n`;
            }
            else {
                prompt += `${ruleIndex}. ${rule}\n`;
                ruleIndex++;
            }
        });
        prompt += '\n';
    }
    if (customInstructions.length > 0) {
        prompt += 'CUSTOM INSTRUCTIONS:\n';
        customInstructions.forEach((instruction, index) => {
            prompt += `${index + 1}. ${instruction}\n`;
        });
        prompt += '\n';
    }
    // Final instruction
    prompt += 'FINAL REQUIREMENTS:\n';
    prompt += '1. Use the EXACT section headers from the template (preserve all text ending with ":")\n';
    prompt += '2. Incorporate EVERY SINGLE finding from the "=== FINDINGS TO INCORPORATE ===" section\n';
    prompt += '3. Follow ALL rules in the sections above without exception\n';
    prompt += '4. Write natural, clinically accurate content within each section\n';
    prompt += '5. Maintain professional medical terminology throughout\n\n';
    prompt += 'Generate the complete radiology report now following all requirements above.\n';
    console.log('🚀 Combined prompt generated with unified rule sections');
    console.log(`Rules breakdown - General: ${generalRules.length}, Findings: ${findingsRules.length}, Impression: ${impressionRules.length}, Custom: ${customInstructions.length}`);
    return prompt;
}
