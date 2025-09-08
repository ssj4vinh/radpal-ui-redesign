const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running migration to add global prompt sections...');
    
    // First, check if columns already exist
    const { data: existingColumns, error: checkError } = await supabase
      .from('agent_logic_layers')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.log('Table check error:', checkError);
    }
    
    // Add columns for global findings and impression section rules
    const alterTableSQL = `
      ALTER TABLE agent_logic_layers 
      ADD COLUMN IF NOT EXISTS global_findings_rules JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS global_impression_rules JSONB DEFAULT NULL;
    `;
    
    const { error: alterError } = await supabase.rpc('exec_sql', { sql: alterTableSQL }).single();
    if (alterError && !alterError.message.includes('already exists')) {
      console.log('Note: Columns may already exist, continuing...');
    }
    
    // Create function to get global prompt sections
    const createGetFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_global_prompt_sections(p_user_id UUID)
      RETURNS TABLE(
        report_base_prompt TEXT,
        impression_base_prompt TEXT,
        global_findings_rules JSONB,
        global_impression_rules JSONB
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          all_layers.report_base_prompt,
          all_layers.impression_base_prompt,
          all_layers.global_findings_rules,
          all_layers.global_impression_rules
        FROM agent_logic_layers all_layers
        WHERE all_layers.user_id = p_user_id 
          AND all_layers.layer_type = 'base';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Create function to update global findings rules
    const createUpdateFindingsFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_global_findings_rules(p_user_id UUID, p_rules JSONB)
      RETURNS VOID AS $$
      BEGIN
        UPDATE agent_logic_layers
        SET global_findings_rules = p_rules,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id 
          AND layer_type = 'base';
          
        -- Create base layer if it doesn't exist
        IF NOT FOUND THEN
          INSERT INTO agent_logic_layers (user_id, layer_type, global_findings_rules)
          VALUES (p_user_id, 'base', p_rules);
        END IF;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Create function to update global impression rules
    const createUpdateImpressionFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_global_impression_rules(p_user_id UUID, p_rules JSONB)
      RETURNS VOID AS $$
      BEGIN
        UPDATE agent_logic_layers
        SET global_impression_rules = p_rules,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = p_user_id 
          AND layer_type = 'base';
          
        -- Create base layer if it doesn't exist
        IF NOT FOUND THEN
          INSERT INTO agent_logic_layers (user_id, layer_type, global_impression_rules)
          VALUES (p_user_id, 'base', p_rules);
        END IF;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Since we can't execute raw SQL directly, we'll need to use the Supabase Dashboard
    console.log('Migration SQL has been generated. Please run the following SQL in your Supabase Dashboard:');
    console.log('\n========== COPY BELOW THIS LINE ==========\n');
    console.log(alterTableSQL);
    console.log(createGetFunctionSQL);
    console.log(createUpdateFindingsFunctionSQL);
    console.log(createUpdateImpressionFunctionSQL);
    console.log('\n-- Grant permissions');
    console.log('GRANT EXECUTE ON FUNCTION get_global_prompt_sections(UUID) TO authenticated;');
    console.log('GRANT EXECUTE ON FUNCTION update_global_findings_rules(UUID, JSONB) TO authenticated;');
    console.log('GRANT EXECUTE ON FUNCTION update_global_impression_rules(UUID, JSONB) TO authenticated;');
    console.log('\n========== COPY ABOVE THIS LINE ==========\n');
    
    console.log('Please go to your Supabase Dashboard -> SQL Editor and run the above SQL.');
    console.log('Dashboard URL: https://app.supabase.com/project/_/sql');
    
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigration();