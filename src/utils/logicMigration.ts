/**
 * Logic Migration Utility
 * Safely migrates existing study-specific logic to the new standardized schema
 * Preserves custom_instructions and exclude_by_default values
 */

import { StandardizedAgentLogic, getDefaultStandardizedLogic } from './standardizedLogicSchema';

export interface MigrationResult {
  success: boolean;
  migratedLogic: StandardizedAgentLogic | null;
  preservedValues: {
    custom_instructions?: string[];
    exclude_by_default?: string[];
  };
  errors: string[];
}

/**
 * Migrate study-specific logic from old format to new standardized format
 * This function carefully preserves important user-configured values
 */
export function migrateStudyLogic(oldLogic: any): MigrationResult {
  const errors: string[] = [];
  const preservedValues: any = {};
  
  try {
    // Start with the default standardized structure
    const newLogic = getDefaultStandardizedLogic();
    
    // 1. Preserve custom_instructions (highest priority)
    if (oldLogic?.custom_instructions) {
      const instructions = Array.isArray(oldLogic.custom_instructions) 
        ? oldLogic.custom_instructions 
        : [oldLogic.custom_instructions];
      
      // Filter out empty strings and validate
      const validInstructions = instructions.filter((inst: any) => 
        typeof inst === 'string' && inst.trim().length > 0
      );
      
      if (validInstructions.length > 0) {
        newLogic.custom_instructions = validInstructions;
        preservedValues.custom_instructions = validInstructions;
      }
    }
    
    // 2. Preserve exclude_by_default from impression
    if (oldLogic?.impression?.exclude_by_default) {
      const excludeList = Array.isArray(oldLogic.impression.exclude_by_default)
        ? oldLogic.impression.exclude_by_default
        : [];
      
      // Filter out empty strings and validate
      const validExclusions = excludeList.filter((item: any) => 
        typeof item === 'string' && item.trim().length > 0
      );
      
      if (validExclusions.length > 0) {
        newLogic.impression.exclude_by_default = validExclusions;
        preservedValues.exclude_by_default = validExclusions;
      }
    }
    
    // 3. Migrate formatting preferences (if they exist)
    if (oldLogic?.formatting) {
      // Bullet points preference
      if (typeof oldLogic.formatting.use_bullet_points === 'boolean') {
        newLogic.report.formatting.use_bullet_points = oldLogic.formatting.use_bullet_points;
        
        // If bullet points are enabled for report, might want them for impression too
        if (oldLogic.formatting.use_bullet_points && !oldLogic.impression?.numerically_itemized) {
          newLogic.impression.format.style = 'bullet_points';
        }
      }
      
      // Template punctuation preference
      if (typeof oldLogic.formatting.preserve_template_punctuation === 'boolean') {
        newLogic.report.formatting.preserve_template_punctuation = oldLogic.formatting.preserve_template_punctuation;
      }
      
      // Capitalization preference
      if (typeof oldLogic.formatting.capitalize_sections === 'boolean') {
        newLogic.report.formatting.prevent_unnecessary_capitalization = !oldLogic.formatting.capitalize_sections;
      }
    }
    
    // 4. Migrate impression formatting
    if (oldLogic?.impression) {
      // Numbered list preference
      if (oldLogic.impression.numerically_itemized === true) {
        newLogic.impression.format.style = 'numerically_itemized';
      } else if (oldLogic.impression.numerically_itemized === false) {
        // Check if bullet points should be used instead
        if (oldLogic.formatting?.use_bullet_points) {
          newLogic.impression.format.style = 'bullet_points';
        } else {
          newLogic.impression.format.style = 'none';
        }
      }
    }
    
    // 5. Migrate report preferences
    if (oldLogic?.report) {
      // Expand lesions preference
      if (typeof oldLogic.report.expand_lesions === 'boolean') {
        newLogic.report.language.expand_lesion_descriptions = oldLogic.report.expand_lesions;
      }
    }
    
    // 6. Migrate any tone preferences (map old style to new)
    if (oldLogic?.style) {
      if (oldLogic.style.active_voice === true) {
        newLogic.general.tone.style = 'definitive';
      } else if (oldLogic.style.professional_tone === true) {
        newLogic.general.tone.style = 'balanced';
      }
    }
    
    return {
      success: true,
      migratedLogic: newLogic,
      preservedValues,
      errors
    };
    
  } catch (error) {
    errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      migratedLogic: null,
      preservedValues,
      errors
    };
  }
}

/**
 * Batch migrate multiple study logic entries
 */
export async function batchMigrateStudyLogic(
  studyLogics: Array<{ study_type: string; logic: any }>
): Promise<Array<{ study_type: string; result: MigrationResult }>> {
  const results = [];
  
  for (const entry of studyLogics) {
    const result = migrateStudyLogic(entry.logic);
    results.push({
      study_type: entry.study_type,
      result
    });
  }
  
  return results;
}

/**
 * Generate a migration report for review
 */
export function generateMigrationReport(
  results: Array<{ study_type: string; result: MigrationResult }>
): string {
  let report = '=== Logic Migration Report ===\n\n';
  
  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);
  
  report += `Total Studies: ${results.length}\n`;
  report += `Successful: ${successful.length}\n`;
  report += `Failed: ${failed.length}\n\n`;
  
  if (successful.length > 0) {
    report += '--- Successfully Migrated ---\n';
    for (const item of successful) {
      report += `\n${item.study_type}:\n`;
      if (item.result.preservedValues.custom_instructions) {
        report += `  • Custom Instructions: ${item.result.preservedValues.custom_instructions.length} preserved\n`;
      }
      if (item.result.preservedValues.exclude_by_default) {
        report += `  • Exclusions: ${item.result.preservedValues.exclude_by_default.length} preserved\n`;
      }
    }
  }
  
  if (failed.length > 0) {
    report += '\n--- Failed Migrations ---\n';
    for (const item of failed) {
      report += `\n${item.study_type}:\n`;
      report += `  Errors: ${item.result.errors.join(', ')}\n`;
    }
  }
  
  return report;
}