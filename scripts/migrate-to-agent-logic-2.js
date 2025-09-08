#!/usr/bin/env node

/**
 * Migration Script: Add agent_logic_2 column for new study-specific logic schema
 * 
 * This script:
 * 1. Adds agent_logic_2 column to templates table
 * 2. Populates it with default study-specific logic
 * 3. Preserves legacy agent_logic column for backward compatibility
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Default study-specific logic structure
function getDefaultStudySpecificLogic() {
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

// Migrate legacy logic to new study-specific format (if needed)
function migrateFromLegacyLogic(legacyLogic) {
  const newLogic = getDefaultStudySpecificLogic();
  
  if (!legacyLogic) return newLogic;
  
  // Migrate exclude_by_default if it exists
  if (legacyLogic.impression?.exclude_by_default) {
    newLogic.study_impression.exclude_by_default = Array.isArray(legacyLogic.impression.exclude_by_default)
      ? legacyLogic.impression.exclude_by_default
      : [];
  }
  
  // Migrate custom_instructions to custom_rules
  if (legacyLogic.custom_instructions) {
    const instructions = Array.isArray(legacyLogic.custom_instructions)
      ? legacyLogic.custom_instructions
      : [legacyLogic.custom_instructions];
    
    newLogic.study_impression.custom_rules = instructions.filter(inst => 
      typeof inst === 'string' && inst.trim().length > 0
    );
  }
  
  // Check for impression formatting preferences
  if (legacyLogic.impression?.numerically_itemized === false) {
    // If not numerically itemized, might be using grouping
    if (legacyLogic.impression?.group_by_anatomy) {
      newLogic.study_impression.grouping_strategy = 'anatomic_region';
    }
  }
  
  return newLogic;
}

async function runMigration() {
  console.log('🚀 Starting Agent Logic 2.0 Migration\n');
  
  try {
    // Step 1: Check if column already exists
    console.log('📊 Checking database schema...');
    const { data: columns, error: schemaError } = await supabase.rpc('get_column_info', {
      table_name: 'templates',
      column_name: 'agent_logic_2'
    }).catch(() => ({ data: null, error: 'Function not found' }));
    
    if (columns) {
      console.log('⚠️  Column agent_logic_2 already exists. Skipping schema modification.\n');
    } else {
      console.log('➕ Adding agent_logic_2 column...');
      // Note: This would need to be done via SQL in Supabase dashboard
      console.log('⚠️  Please add the following column via Supabase SQL editor:');
      console.log('   ALTER TABLE templates ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB;');
      console.log('   ALTER TABLE templates ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMPTZ;\n');
      console.log('After adding the column, run this script again to populate defaults.\n');
      return;
    }
    
    // Step 2: Fetch all templates
    console.log('📥 Fetching all templates...');
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
      .select('id, user_id, study_type, agent_logic, agent_logic_2');
    
    if (fetchError) {
      throw new Error(`Failed to fetch templates: ${fetchError.message}`);
    }
    
    console.log(`✅ Found ${templates.length} templates\n`);
    
    // Step 3: Update each template with new logic
    console.log('🔄 Migrating templates to new study-specific logic...');
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const template of templates) {
      // Skip if already has agent_logic_2
      if (template.agent_logic_2 && Object.keys(template.agent_logic_2).length > 0) {
        skipCount++;
        console.log(`⏭️  Skipping ${template.study_type} (already has agent_logic_2)`);
        continue;
      }
      
      try {
        // Migrate from legacy logic if available, otherwise use defaults
        const newStudyLogic = template.agent_logic 
          ? migrateFromLegacyLogic(template.agent_logic)
          : getDefaultStudySpecificLogic();
        
        const { error: updateError } = await supabase
          .from('templates')
          .update({ 
            agent_logic_2: newStudyLogic,
            agent_logic_2_updated_at: new Date().toISOString()
          })
          .eq('id', template.id);
        
        if (updateError) {
          throw updateError;
        }
        
        successCount++;
        console.log(`✅ Migrated ${template.study_type}`);
        
      } catch (error) {
        failCount++;
        console.log(`❌ Failed to migrate ${template.study_type}: ${error.message}`);
      }
    }
    
    // Step 4: Generate report
    console.log('\n📊 Migration Report:');
    console.log('==================');
    console.log(`Total templates: ${templates.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped (already migrated): ${skipCount}`);
    console.log(`Failed: ${failCount}`);
    
    if (successCount > 0) {
      console.log('\n✨ Migration completed successfully!');
      console.log('📝 Note: The legacy agent_logic column has been preserved for backward compatibility.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// SQL to run in Supabase Dashboard first:
console.log('📋 SQL to run in Supabase Dashboard:\n');
console.log(`
-- Add new columns for agent_logic_2
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMPTZ;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_templates_agent_logic_2 ON templates USING GIN (agent_logic_2);

-- Optional: Add comment to document the column
COMMENT ON COLUMN templates.agent_logic_2 IS 'Study-specific logic using new v1.0 schema (separate from base logic)';
`);

console.log('\n⚠️  After running the SQL above, press Enter to continue with data migration...');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Press Enter to continue...', () => {
  rl.close();
  runMigration();
});