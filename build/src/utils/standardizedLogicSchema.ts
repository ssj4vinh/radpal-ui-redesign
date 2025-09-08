/**
 * Standardized JSONB Schema for Agent Logic
 * Version 3.0
 * 
 * This schema ensures consistent structure across all logic files
 * with fixed categories, sections, and configurable options
 */

export interface StandardizedAgentLogic {
  version: string;
  general: GeneralCategory;
  report: ReportCategory;
  impression: ImpressionCategory;
  custom_instructions?: string[]; // Preserved from old schema
}

export interface StudySpecificLogic {
  version: string;
  study_report: StudyReportCategory;  // Changed from 'report' to 'study_report'
  study_impression: StudyImpressionCategory;  // Changed from 'impression' to 'study_impression'
}

interface GeneralCategory {
  corrections: {
    rules: Array<{
      find: string;
      replace: string;
      description?: string;
    }>;
  };
  tone: {
    style: 'definitive' | 'cautious' | 'balanced';
    cautious_phrases?: string[]; // e.g., ["suggests", "likely", "appears to be"]
    definitive_phrases?: string[]; // e.g., ["is", "demonstrates", "shows"]
  };
  allowed_sections: {
    enabled: boolean;
    sections: string[];
  };
  disallowed_symbols: {
    enabled: boolean;
    symbols: string[];
  };
  disallowed_items: {
    patient_identifiers: boolean;
    names: boolean;
    radiology_report_title: boolean;
    referring_physician: boolean;
    radiologist_signature: boolean;
    credentials: boolean;
    date: boolean;
  };
}

interface ReportCategory {
  formatting: {
    use_bullet_points: boolean;
    preserve_template_punctuation: boolean;
    prevent_unnecessary_capitalization: boolean;
    preserve_spacing_and_capitalization: boolean;
  };
  language: {
    avoid_words: {
      enabled: boolean;
      words: string[];
    };
    avoid_phrases: {
      enabled: boolean;
      phrases: string[];
    };
    expand_lesion_descriptions: boolean;
  };
}

interface ImpressionCategory {
  format: {
    style: 'numerically_itemized' | 'bullet_points' | 'none';
    spacing: 'double' | 'single';
  };
  exclude_by_default?: string[]; // Preserved from old schema
}

// Study-specific categories
interface StudyReportCategory {
  anatomic_routing_rules?: Array<{
    condition: string;
    route_to: string;
    description?: string;
  }>;
  custom_rules?: string[];
}

interface StudyImpressionCategory {
  required_opening_phrase?: {
    enabled: boolean;
    phrase: string;
  };
  priority?: {
    high_priority_findings?: string[];
    high_priority_keywords?: string[];
    mid_priority_findings?: string[];
    mid_priority_keywords?: string[];
    low_priority_findings?: string[];
    low_priority_keywords?: string[];
  };
  exclude_by_default?: string[];
  grouping_strategy?: 'severity' | 'anatomic_region' | 'clinical_relevance';
  auto_reordering?: boolean;
  custom_rules?: string[];
}

/**
 * Default values for the standardized logic schema
 */
export function getDefaultStandardizedLogic(): StandardizedAgentLogic {
  return {
    version: "3.0",
    general: {
      corrections: {
        rules: [
          {
            find: "chondral labral",
            replace: "chondrolabral",
            description: "Correct chondrolabral terminology"
          }
        ]
      },
      tone: {
        style: 'balanced'
      },
      allowed_sections: {
        enabled: true,
        sections: ["FINDINGS", "IMPRESSION"]
      },
      disallowed_symbols: {
        enabled: true,
        symbols: ["*", "**", "###", "##"]
      },
      disallowed_items: {
        patient_identifiers: true,
        names: true,
        radiology_report_title: true,
        referring_physician: true,
        radiologist_signature: true,
        credentials: true,
        date: true
      }
    },
    report: {
      formatting: {
        use_bullet_points: false,
        preserve_template_punctuation: true,
        prevent_unnecessary_capitalization: true,
        preserve_spacing_and_capitalization: true
      },
      language: {
        avoid_words: {
          enabled: false,
          words: []
        },
        avoid_phrases: {
          enabled: false,
          phrases: []
        },
        expand_lesion_descriptions: false
      }
    },
    impression: {
      format: {
        style: 'numerically_itemized',
        spacing: 'double'
      },
      exclude_by_default: []
    }
  };
}

/**
 * Migrate old logic format to new standardized format
 * Preserves custom_instructions and exclude_by_default
 */
export function migrateToStandardizedLogic(oldLogic: any): StandardizedAgentLogic {
  const newLogic = getDefaultStandardizedLogic();
  
  // Preserve custom instructions
  if (oldLogic?.custom_instructions) {
    newLogic.custom_instructions = Array.isArray(oldLogic.custom_instructions) 
      ? oldLogic.custom_instructions 
      : [oldLogic.custom_instructions];
  }
  
  // Preserve exclude_by_default
  if (oldLogic?.impression?.exclude_by_default) {
    newLogic.impression.exclude_by_default = oldLogic.impression.exclude_by_default;
  }
  
  // Migrate formatting settings
  if (oldLogic?.formatting) {
    if (typeof oldLogic.formatting.use_bullet_points === 'boolean') {
      newLogic.report.formatting.use_bullet_points = oldLogic.formatting.use_bullet_points;
    }
    if (typeof oldLogic.formatting.preserve_template_punctuation === 'boolean') {
      newLogic.report.formatting.preserve_template_punctuation = oldLogic.formatting.preserve_template_punctuation;
    }
  }
  
  // Migrate impression formatting
  if (oldLogic?.impression) {
    if (oldLogic.impression.numerically_itemized === true) {
      newLogic.impression.format.style = 'numerically_itemized';
    } else if (oldLogic.formatting?.use_bullet_points === true) {
      newLogic.impression.format.style = 'bullet_points';
    }
  }
  
  // Migrate report settings
  if (oldLogic?.report) {
    if (typeof oldLogic.report.expand_lesions === 'boolean') {
      newLogic.report.language.expand_lesion_descriptions = oldLogic.report.expand_lesions;
    }
  }
  
  return newLogic;
}

/**
 * Default values for study-specific logic
 */
export function getDefaultStudySpecificLogic(): StudySpecificLogic {
  return {
    version: "1.0",
    study_report: {
      anatomic_routing_rules: [],
      custom_rules: []
    },
    study_impression: {
      required_opening_phrase: {
        enabled: false,
        phrase: ""
      },
      priority: {
        high_priority_findings: [],
        high_priority_keywords: [],
        mid_priority_findings: [],
        mid_priority_keywords: [],
        low_priority_findings: [],
        low_priority_keywords: []
      },
      exclude_by_default: [],
      grouping_strategy: 'severity',
      auto_reordering: true,
      custom_rules: []
    }
  };
}

/**
 * Validate that a logic object conforms to the standardized schema
 */
export function validateStandardizedLogic(logic: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!logic || typeof logic !== 'object') {
    errors.push('Logic must be an object');
    return { valid: false, errors };
  }
  
  // Check required top-level categories
  const requiredCategories = ['general', 'report', 'impression'];
  for (const category of requiredCategories) {
    if (!(category in logic)) {
      errors.push(`Missing required category: ${category}`);
    }
  }
  
  // Validate general category structure
  if (logic.general) {
    const requiredGeneralSections = ['corrections', 'tone', 'allowed_sections', 'disallowed_symbols', 'disallowed_items'];
    for (const section of requiredGeneralSections) {
      if (!(section in logic.general)) {
        errors.push(`Missing required section in general: ${section}`);
      }
    }
  }
  
  // Validate report category structure
  if (logic.report) {
    const requiredReportSections = ['formatting', 'language'];
    for (const section of requiredReportSections) {
      if (!(section in logic.report)) {
        errors.push(`Missing required section in report: ${section}`);
      }
    }
  }
  
  // Validate impression category structure
  if (logic.impression) {
    if (!logic.impression.format) {
      errors.push('Missing required section in impression: format');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}