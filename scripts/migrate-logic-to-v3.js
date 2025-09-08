#!/usr/bin/env node

/**
 * Migration Script: Update agent logic to v3.0 standardized schema
 * 
 * This script:
 * 1. Resets all base logic to the new standardized format
 * 2. Migrates study-specific logic preserving custom_instructions and exclude_by_default
 * 3. Creates a backup before migration
 * 4. Generates a migration report
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Default standardized logic structure
function getDefaultStandardizedLogic() {
  return {
    version: "3.0",
    general: {
      corrections: {
        rules: [
          {
            find: "  ",
            replace: " ",
            description: "Replace double spaces with single space"
          },
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

// Migrate study-specific logic
function migrateStudyLogic(oldLogic) {
  const newLogic = getDefaultStandardizedLogic();
  
  if (!oldLogic) return newLogic;
  
  // Preserve custom_instructions
  if (oldLogic.custom_instructions) {
    const instructions = Array.isArray(oldLogic.custom_instructions) 
      ? oldLogic.custom_instructions 
      : [oldLogic.custom_instructions];
    
    const validInstructions = instructions.filter(inst => 
      typeof inst === 'string' && inst.trim().length > 0
    );
    
    if (validInstructions.length > 0) {
      newLogic.custom_instructions = validInstructions;
    }
  }
  
  // Preserve exclude_by_default
  if (oldLogic.impression?.exclude_by_default) {
    const excludeList = Array.isArray(oldLogic.impression.exclude_by_default)
      ? oldLogic.impression.exclude_by_default
      : [];
    
    const validExclusions = excludeList.filter(item => 
      typeof item === 'string' && item.trim().length > 0
    );
    
    if (validExclusions.length > 0) {
      newLogic.impression.exclude_by_default = validExclusions;
    }
  }
  
  // Migrate corrections if they exist
  if (oldLogic.general?.corrections) {
    if (Array.isArray(oldLogic.general.corrections.rules)) {
      newLogic.general.corrections.rules = oldLogic.general.corrections.rules;
    }
  }
  
  // Migrate disallowed_items from array to boolean fields
  if (oldLogic.general?.disallowed_items) {
    if (Array.isArray(oldLogic.general.disallowed_items.items)) {
      const items = oldLogic.general.disallowed_items.items;
      newLogic.general.disallowed_items = {
        patient_identifiers: items.includes('patient identifiers'),
        names: items.includes('names'),
        radiology_report_title: items.includes('radiology report') || items.includes('radiology report title'),
        referring_physician: items.includes('referring physician'),
        radiologist_signature: items.includes('radiologist signature'),
        credentials: items.includes('credentials'),
        date: items.includes('date')
      };
    }
  }
  
  // Migrate formatting preferences
  if (oldLogic.formatting) {
    if (typeof oldLogic.formatting.use_bullet_points === 'boolean') {
      newLogic.report.formatting.use_bullet_points = oldLogic.formatting.use_bullet_points;
      if (oldLogic.formatting.use_bullet_points && !oldLogic.impression?.numerically_itemized) {
        newLogic.impression.format.style = 'bullet_points';
      }
    }
    
    if (typeof oldLogic.formatting.preserve_template_punctuation === 'boolean') {
      newLogic.report.formatting.preserve_template_punctuation = oldLogic.formatting.preserve_template_punctuation;
    }
  }
  
  // Migrate impression formatting
  if (oldLogic.impression?.numerically_itemized === true) {
    newLogic.impression.format.style = 'numerically_itemized';
  } else if (oldLogic.impression?.numerically_itemized === false) {
    if (oldLogic.formatting?.use_bullet_points) {
      newLogic.impression.format.style = 'bullet_points';
    } else {
      newLogic.impression.format.style = 'none';
    }
  }
  
  // Migrate report preferences
  if (oldLogic.report?.expand_lesions === true) {
    newLogic.report.language.expand_lesion_descriptions = true;
  }
  
  return newLogic;
}

async function runMigration() {
  console.log('🚀 Starting Logic Migration to v3.0 Standardized Schema\n');
  
  try {
    // Step 1: Create backup
    console.log('📦 Creating backup...');
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('id, user_id, study_type, agent_logic, default_agent_logic');
    
    if (fetchError) {
      throw new Error(`Failed to fetch templates: ${fetchError.message}`);
    }
    
    // Save backup to file
    const fs = require('fs');
    const backupPath = `./backup_logic_${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(templates, null, 2));
    console.log(`✅ Backup saved to ${backupPath}\n`);
    
    // Step 2: Reset all base logic
    console.log('🔄 Resetting base logic to standardized format...');
    const defaultLogic = getDefaultStandardizedLogic();
    
    const { error: updateBaseError } = await supabase
      .from('templates')
      .update({ 
        default_agent_logic: defaultLogic,
        default_agent_logic_updated_at: new Date().toISOString()
      })
      .not('default_agent_logic', 'is', null);
    
    if (updateBaseError) {
      console.error('⚠️ Error updating base logic:', updateBaseError.message);
    } else {
      console.log('✅ Base logic reset completed\n');
    }
    
    // Step 3: Migrate study-specific logic
    console.log('🔄 Migrating study-specific logic...');
    let successCount = 0;
    let failCount = 0;
    const migrationReport = [];
    
    for (const template of templates) {
      if (template.agent_logic) {
        try {
          const migratedLogic = migrateStudyLogic(template.agent_logic);
          
          const { error: updateError } = await supabase
            .from('templates')
            .update({ 
              agent_logic: migratedLogic,
              agent_logic_updated_at: new Date().toISOString()
            })
            .eq('id', template.id);
          
          if (updateError) {
            throw updateError;
          }
          
          successCount++;
          migrationReport.push({
            study_type: template.study_type,
            status: 'success',
            preserved: {
              custom_instructions: migratedLogic.custom_instructions?.length || 0,
              exclusions: migratedLogic.impression.exclude_by_default?.length || 0
            }
          });
          
        } catch (error) {
          failCount++;
          migrationReport.push({
            study_type: template.study_type,
            status: 'failed',
            error: error.message
          });
        }
      }
    }
    
    // Step 4: Generate report
    console.log('\n📊 Migration Report:');
    console.log('==================');
    console.log(`Total templates: ${templates.length}`);
    console.log(`Successful migrations: ${successCount}`);
    console.log(`Failed migrations: ${failCount}\n`);
    
    if (migrationReport.length > 0) {
      console.log('Details:');
      migrationReport.forEach(item => {
        if (item.status === 'success') {
          console.log(`✅ ${item.study_type}: Preserved ${item.preserved.custom_instructions} instructions, ${item.preserved.exclusions} exclusions`);
        } else {
          console.log(`❌ ${item.study_type}: ${item.error}`);
        }
      });
    }
    
    console.log('\n✨ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
runMigration();