// IPC handlers for agent logic v2 (study-specific logic in agent_logic_2 column)
const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// Load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv not available in production, which is fine
  }
}

// Load config
let config;
try {
  config = require('./config.json');
} catch (e) {
  console.log('⚠️ Config file not found in agentLogicIPCV2, using environment variables');
  config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
  };
}

// Initialize Supabase client with the global session
let supabase = null;

function initializeSupabase() {
  const session = global.supabaseSession;
  const supabaseUrl = config.VITE_SUPABASE_URL;
  const supabaseKey = config.VITE_SUPABASE_ANON_KEY;
  
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or key not configured');
    return;
  }
  
  try {
    if (session?.access_token) {
      console.log('✅ Initializing Supabase WITH auth token');
      supabase = createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );
    } else {
      // Initialize without auth token but will need to re-init when session is available
      console.log('⚠️ Supabase client initialized WITHOUT auth in agentLogicIPCV2 - queries may fail due to RLS');
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    throw error;
  }
}

// Default study-specific logic structure
function getDefaultStudySpecificLogic() {
  return {
    version: "1.0",
    study_report: {
      corrections: {
        rules: []
      },
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

// Note: Global base prompt is now stored in the global_base_prompt table

// Default base logic structure (v3.0 schema)
// Only used when no data exists in database
function getDefaultBaseLogic() {
  return {
    version: "3.0",
    general: {
      corrections: {
        rules: []  // Empty by default - user should add their own
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

function registerAgentLogicV2Handlers() {
  // Initialize Supabase when handlers are registered
  initializeSupabase();
  
  // Listen for session updates
  ipcMain.on('update-supabase-session', (event, session) => {
    console.log('📍 Session update received in agentLogicIPCV2:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      userId: session?.user?.id
    });
    // Update global session and reinitialize
    if (session) {
      global.supabaseSession = session;
    }
    initializeSupabase();
  });
  
  // Fetch agent logic v2 (base + study-specific)
  ipcMain.handle('fetch-agent-logic-v2', async (event, userId, studyType) => {
    try {
      // ALWAYS reinitialize to ensure we have the latest session
      console.log('🔄 Reinitializing Supabase with current session...');
      initializeSupabase();
      
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      // Check if we have proper auth
      const session = global.supabaseSession;
      console.log('🔐 Current session state:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        tokenSample: session?.access_token ? session.access_token.substring(0, 20) + '...' : 'none'
      });
      
      // Get study-specific logic from agent_logic_2 column (with fallback to agent_logic)
      console.log('📍 Fetching template for user:', userId, 'study:', studyType);
      
      // First, let's check ALL templates for this user to see what study types exist
      const { data: allTemplates, error: allError } = await supabase
        .from('templates')
        .select('study_type, agent_logic_2, agent_logic')
        .eq('user_id', userId);
      
      console.log('📊 ALL TEMPLATES for user:', {
        count: allTemplates ? allTemplates.length : 0,
        studyTypes: allTemplates ? allTemplates.map(t => t.study_type) : [],
        error: allError
      });
      
      let template = null;
      
      // Now try to get the specific one
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('agent_logic_2, agent_logic')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      console.log('📊 Template query result:', {
        hasData: !!templateData,
        error: templateError,
        agent_logic_2_type: templateData ? typeof templateData.agent_logic_2 : 'N/A',
        agent_logic_type: templateData ? typeof templateData.agent_logic : 'N/A',
        agent_logic_2_null: templateData ? templateData.agent_logic_2 === null : 'N/A',
        agent_logic_null: templateData ? templateData.agent_logic === null : 'N/A',
        agent_logic_2_value: templateData?.agent_logic_2 ? JSON.stringify(templateData.agent_logic_2).substring(0, 500) : 'null/undefined',
        agent_logic_value: templateData?.agent_logic ? JSON.stringify(templateData.agent_logic).substring(0, 500) : 'null/undefined'
      });
      
      // LOG THE RAW DATA
      if (templateData) {
        console.log('🔍 RAW agent_logic_2:', templateData.agent_logic_2);
        console.log('🔍 RAW agent_logic:', templateData.agent_logic);
      }
      
      // If no template exists, we need to create one first
      if (templateError && templateError.code === 'PGRST116') {
        console.log('📝 No template exists for this study type, creating one...');
        
        // Create a basic template
        const { data: newTemplate, error: createError } = await supabase
          .from('templates')
          .insert({
            user_id: userId,
            study_type: studyType,
            template: '',  // Empty template
            agent_logic: null,
            agent_logic_2: null,
            generate_prompt: null,
            generate_impression: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Failed to create template:', createError);
        } else {
          console.log('✅ Created new template:', newTemplate);
          template = newTemplate;
        }
      } else if (templateError && templateError.code !== 'PGRST116') {
        // If column doesn't exist, try just agent_logic
        if (templateError.code === '42703' && templateError.message.includes('agent_logic_2')) {
          console.log('agent_logic_2 column not found, falling back to agent_logic');
          const { data: fallbackTemplate, error: fallbackError } = await supabase
            .from('templates')
            .select('agent_logic')
            .eq('user_id', userId)
            .eq('study_type', studyType)
            .single();
          
          if (fallbackError && fallbackError.code !== 'PGRST116') {
            console.error('Error fetching fallback logic:', fallbackError);
          }
          template = fallbackTemplate;
        } else {
          console.error('Error fetching study logic v2:', templateError);
        }
      } else {
        template = templateData;
      }
      
      console.log('Template data fetched:', {
        hasTemplate: !!template,
        hasAgentLogic2: template?.agent_logic_2 !== undefined,
        hasAgentLogic: template?.agent_logic !== undefined,
        agentLogicKeys: template?.agent_logic ? Object.keys(template.agent_logic) : []
      });
      
      // Get base logic from user_default_logic table
      console.log('📍 Fetching base logic for user:', userId);
      
      // First check all rows in user_default_logic
      const { data: allBaseLogic, error: allBaseError } = await supabase
        .from('user_default_logic')
        .select('user_id, default_agent_logic');
      
      console.log('📊 ALL BASE LOGIC entries:', {
        count: allBaseLogic ? allBaseLogic.length : 0,
        userIds: allBaseLogic ? allBaseLogic.map(b => b.user_id) : [],
        currentUserFound: allBaseLogic ? allBaseLogic.some(b => b.user_id === userId) : false,
        error: allBaseError
      });
      
      let baseTemplate = null;
      const { data: baseData, error: baseError } = await supabase
        .from('user_default_logic')
        .select('default_agent_logic')
        .eq('user_id', userId)
        .single();
      
      console.log('📊 Base logic query result:', {
        hasData: !!baseData,
        error: baseError,
        default_agent_logic_type: baseData ? typeof baseData.default_agent_logic : 'N/A',
        default_agent_logic_null: baseData ? baseData.default_agent_logic === null : 'N/A',
        default_agent_logic_sample: baseData?.default_agent_logic ? 
          JSON.stringify(baseData.default_agent_logic).substring(0, 100) : 'N/A'
      });
      
      if (baseError) {
        if (baseError.code === 'PGRST116') {
          // No row exists for this user yet - create one with defaults
          console.log('No base logic found for user, creating default entry...');
          
          const defaultBase = getDefaultBaseLogic();
          const { data: newBaseLogic, error: createBaseError } = await supabase
            .from('user_default_logic')
            .insert({
              user_id: userId,
              default_agent_logic: defaultBase,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createBaseError) {
            console.error('Failed to create base logic:', createBaseError);
            // If insert fails (might already exist), try to update
            const { data: updateData, error: updateError } = await supabase
              .from('user_default_logic')
              .upsert({
                user_id: userId,
                default_agent_logic: defaultBase,
                updated_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (updateError) {
              console.error('Failed to upsert base logic:', updateError);
            } else {
              console.log('✅ Upserted base logic:', updateData);
              baseTemplate = updateData;
            }
          } else {
            console.log('✅ Created new base logic:', newBaseLogic);
            baseTemplate = newBaseLogic;
          }
        } else {
          console.error('Error fetching base logic:', baseError);
        }
      } else {
        baseTemplate = baseData;
      }
      
      // Parse the logic from database - it might be a string
      // DIRECTLY USE the data from database queries
      let studyLogic = templateData?.agent_logic_2;  // Use templateData directly
      let baseLogic = baseData?.default_agent_logic;  // Use baseData directly
      
      // IMPORTANT: If agent_logic_2 is null but we have agent_logic, use that as fallback
      let legacyLogic = templateData?.agent_logic;  // Use templateData directly
      
      console.log('📊 Raw logic from database:', {
        studyLogicType: typeof studyLogic,
        baseLogicType: typeof baseLogic,
        legacyLogicType: typeof legacyLogic,
        studyLogicNull: studyLogic === null,
        baseLogicNull: baseLogic === null,
        legacyLogicNull: legacyLogic === null,
        studyLogicKeys: studyLogic && typeof studyLogic === 'object' ? Object.keys(studyLogic) : 'N/A',
        baseLogicKeys: baseLogic && typeof baseLogic === 'object' ? Object.keys(baseLogic) : 'N/A',
        legacyLogicKeys: legacyLogic && typeof legacyLogic === 'object' ? Object.keys(legacyLogic) : 'N/A'
      });
      
      // Parse if needed (sometimes Supabase returns JSON as string)
      if (typeof studyLogic === 'string') {
        try {
          studyLogic = JSON.parse(studyLogic);
        } catch (e) {
          console.error('Failed to parse study logic:', e);
          studyLogic = null;
        }
      }
      
      if (typeof baseLogic === 'string') {
        try {
          baseLogic = JSON.parse(baseLogic);
        } catch (e) {
          console.error('Failed to parse base logic:', e);
          baseLogic = null;
        }
      }
      
      if (typeof legacyLogic === 'string') {
        try {
          legacyLogic = JSON.parse(legacyLogic);
          console.log('Parsed legacy logic from string');
        } catch (e) {
          console.error('Failed to parse legacy logic:', e);
          legacyLogic = null;
        }
      }
      
      // Check if logic is empty object and treat as null
      if (studyLogic && typeof studyLogic === 'object' && Object.keys(studyLogic).length === 0) {
        console.log('Study logic is empty object, treating as null');
        studyLogic = null;
      }
      
      if (baseLogic && typeof baseLogic === 'object' && Object.keys(baseLogic).length === 0) {
        console.log('Base logic is empty object, treating as null');
        baseLogic = null;
      }
      
      // Only use defaults if data wasn't found or couldn't be parsed
      // BUT if the column exists and is null, that's different from not having the column
      if (!studyLogic && templateData && !templateData.hasOwnProperty('agent_logic_2')) {
        // Column doesn't exist at all, use defaults
        console.log('⚠️ No agent_logic_2 column found, using defaults');
        studyLogic = getDefaultStudySpecificLogic();
      } else if (!studyLogic) {
        // Column exists but is null/empty - use empty object
        console.log('📝 agent_logic_2 is null/empty, using empty study logic');
        studyLogic = {};
      } else {
        console.log('✅ Using study logic from database:', {
          hasStudyReport: !!studyLogic.study_report,
          hasStudyImpression: !!studyLogic.study_impression,
          studyReportKeys: studyLogic.study_report ? Object.keys(studyLogic.study_report) : [],
          studyImpressionKeys: studyLogic.study_impression ? Object.keys(studyLogic.study_impression) : []
        });
      }
      
      if (!baseLogic) {
        // Check if we can use legacy logic instead
        if (legacyLogic && typeof legacyLogic === 'object' && Object.keys(legacyLogic).length > 0) {
          console.log('⚠️ No base logic found, but using legacy agent_logic as fallback');
          // Legacy logic should be returned as merged logic
          baseLogic = legacyLogic;
          studyLogic = {}; // No separate study logic in legacy system
        } else {
          console.log('⚠️ No valid base logic or legacy logic found, using defaults');
          baseLogic = getDefaultBaseLogic();
        }
      } else {
        console.log('✅ Using base logic from database:', {
          hasGeneral: !!baseLogic.general,
          hasReport: !!baseLogic.report,
          hasImpression: !!baseLogic.impression,
          generalKeys: baseLogic.general ? Object.keys(baseLogic.general) : [],
          reportKeys: baseLogic.report ? Object.keys(baseLogic.report) : [],
          impressionKeys: baseLogic.impression ? Object.keys(baseLogic.impression) : []
        });
      }
      
      // Properly merge base and study logic into unified sections
      // Base logic has: general, report, impression
      // Study logic has: study_report, study_impression
      // We want to combine them into a single unified structure
      const mergedLogic = {
        version: baseLogic.version || "3.0",
        // Copy base sections
        general: baseLogic.general ? JSON.parse(JSON.stringify(baseLogic.general)) : {},
        report: baseLogic.report ? JSON.parse(JSON.stringify(baseLogic.report)) : {},
        impression: baseLogic.impression ? JSON.parse(JSON.stringify(baseLogic.impression)) : {},
        // Keep study sections separate for the editor, but also merge them into the main sections
        study_report: studyLogic.study_report || {},
        study_impression: studyLogic.study_impression || {},
        // Merge custom_instructions from both
        custom_instructions: [
          ...(baseLogic.custom_instructions || []),
          ...(studyLogic.custom_instructions || [])
        ].filter(Boolean) // Remove any null/undefined values
      };
      
      // Now merge study-specific rules into the main sections for prompt generation
      if (studyLogic.study_report) {
        // Merge corrections - combine base and study corrections
        const baseCorrections = baseLogic.report?.corrections?.rules || [];
        const studyCorrections = studyLogic.study_report.corrections?.rules || [];
        
        if (baseCorrections.length > 0 || studyCorrections.length > 0) {
          if (!mergedLogic.report.corrections) {
            mergedLogic.report.corrections = { rules: [] };
          }
          // Combine both base and study corrections
          mergedLogic.report.corrections.rules = [
            ...baseCorrections,
            ...studyCorrections
          ];
        }
        
        // Add anatomic routing rules
        if (studyLogic.study_report.anatomic_routing_rules) {
          mergedLogic.report.anatomic_routing_rules = studyLogic.study_report.anatomic_routing_rules;
        }
        
        // Merge custom rules
        if (studyLogic.study_report.custom_rules) {
          mergedLogic.report.custom_rules = [
            ...(baseLogic.report?.custom_rules || []),
            ...studyLogic.study_report.custom_rules
          ];
        }
      }
      
      // Merge study-specific impression rules
      if (studyLogic.study_impression) {
        // Merge exclusions - avoid duplicates by checking if already merged
        const baseExclusions = baseLogic.impression?.exclude_by_default || [];
        const studyExclusions = studyLogic.study_impression.exclude_by_default || [];
        
        if (baseExclusions.length > 0 || studyExclusions.length > 0) {
          // Combine exclusions, avoiding duplicates
          mergedLogic.impression.exclude_by_default = [
            ...baseExclusions,
            ...studyExclusions
          ];
        }
        
        // Override or add study-specific impression settings
        if (studyLogic.study_impression.required_opening_phrase) {
          mergedLogic.impression.required_opening_phrase = studyLogic.study_impression.required_opening_phrase;
        }
        
        if (studyLogic.study_impression.priority) {
          mergedLogic.impression.priority = studyLogic.study_impression.priority;
        }
        
        if (studyLogic.study_impression.grouping_strategy) {
          mergedLogic.impression.grouping_strategy = studyLogic.study_impression.grouping_strategy;
        }
        
        if (studyLogic.study_impression.auto_reordering !== undefined) {
          mergedLogic.impression.auto_reordering = studyLogic.study_impression.auto_reordering;
        }
        
        // Merge custom impression rules
        if (studyLogic.study_impression.custom_rules) {
          mergedLogic.impression.custom_rules = [
            ...(baseLogic.impression?.custom_rules || []),
            ...studyLogic.study_impression.custom_rules
          ];
        }
      }
      
      console.log('📦 Merged logic structure:', {
        hasGeneral: !!mergedLogic.general,
        hasReport: !!mergedLogic.report,
        hasImpression: !!mergedLogic.impression,
        hasStudyReport: !!mergedLogic.study_report,
        hasStudyImpression: !!mergedLogic.study_impression,
        version: mergedLogic.version
      });
      
      // Keep track of original legacy logic for reference
      const originalLegacyLogic = template?.agent_logic || null;
      console.log('Returning logic:', {
        hasLegacyLogic: !!originalLegacyLogic,
        legacyLogicType: typeof originalLegacyLogic,
        usingLegacyAsFallback: !baseTemplate && originalLegacyLogic
      });
      
      // Final return with explicit logging
      const result = {
        success: true,
        baseLogic,
        studyLogic,
        mergedLogic,
        legacyLogic: originalLegacyLogic // Include original legacy for reference
      };
      
      console.log('🚀 RETURNING TO CLIENT:', {
        hasBaseLogic: !!result.baseLogic,
        hasStudyLogic: !!result.studyLogic,
        hasMergedLogic: !!result.mergedLogic,
        hasLegacyLogic: !!result.legacyLogic,
        baseLogicSample: result.baseLogic ? JSON.stringify(result.baseLogic).substring(0, 200) : 'null',
        mergedLogicKeys: result.mergedLogic ? Object.keys(result.mergedLogic) : []
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching agent logic v2:', error);
      return { 
        success: false, 
        error: error.message,
        baseLogic: getDefaultBaseLogic(),
        studyLogic: getDefaultStudySpecificLogic()
      };
    }
  });
  
  // Update base logic in user_default_logic table
  ipcMain.handle('update-base-logic-v2', async (event, userId, baseLogic) => {
    try {
      
      // Always reinitialize to ensure we have the latest session
      initializeSupabase();
      
      if (!supabase) {
        const error = new Error('Supabase client could not be initialized. Check configuration.');
        throw error;
      }
      
      // Check if we have auth
      if (!global.supabaseSession?.access_token) {
        throw new Error('Authentication required for saving logic');
      }
      
      // Use the database function that bypasses RLS
      console.log('📝 Saving base logic:', {
        userId,
        logicKeys: Object.keys(baseLogic || {}),
        logicSize: JSON.stringify(baseLogic).length,
        logicSample: JSON.stringify(baseLogic).substring(0, 200)
      });
      
      // Try direct database operations first (temporary for debugging)
      
      // First, try to delete existing row
      const { error: deleteError } = await supabase
        .from('user_default_logic')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError && deleteError.code !== 'PGRST116') {
      }
      
      // Then insert new row
      const { data: insertData, error: insertError } = await supabase
        .from('user_default_logic')
        .insert({
          user_id: userId,
          default_agent_logic: baseLogic,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        
        // If insert fails, try update
        const { data: updateData, error: updateError } = await supabase
          .from('user_default_logic')
          .update({
            default_agent_logic: baseLogic,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select();
        
        if (updateError) {
          throw updateError;
        }
        
      } else {
      }
      
      // Verify the save by fetching it back
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_default_logic')
        .select('default_agent_logic')
        .eq('user_id', userId)
        .single();
      
      if (verifyError) {
        console.log('⚠️ Could not verify save:', verifyError);
      } else {
        console.log('✅ Verified save:', {
          hasData: !!verifyData?.default_agent_logic,
          dataKeys: verifyData?.default_agent_logic ? Object.keys(verifyData.default_agent_logic) : []
        });
      }
      
      return { success: true, baseLogic: verifyData?.default_agent_logic || baseLogic };
    } catch (error) {
      console.error('Error updating base logic:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Update study-specific logic v2 (uses agent_logic_2 column)
  ipcMain.handle('update-study-logic-v2', async (event, userId, studyType, studyLogic) => {
    try {
      
      // Always reinitialize to ensure we have the latest session
      initializeSupabase();
      
      if (!supabase) {
        const error = new Error('Supabase client could not be initialized. Check configuration.');
        throw error;
      }
      
      // Check if we have auth
      if (!global.supabaseSession?.access_token) {
        throw new Error('Authentication required for saving logic');
      }
      
      console.log('📝 Saving study logic for:', {
        userId,
        studyType,
        hasLogic: !!studyLogic,
        logicKeys: studyLogic ? Object.keys(studyLogic) : []
      });
      
      // Use the database function that bypasses RLS
      console.log('📝 Study logic details:', {
        userId,
        studyType,
        logicKeys: Object.keys(studyLogic || {}),
        logicSize: JSON.stringify(studyLogic).length,
        logicSample: JSON.stringify(studyLogic).substring(0, 200)
      });
      
      // Try direct database update (temporary for debugging)
      
      const { data: directUpdate, error: directError } = await supabase
        .from('templates')
        .update({
          agent_logic_2: studyLogic,
          agent_logic_2_updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .select();
      
      if (directError) {
        console.error('Direct update failed:', {
          code: directError.code,
          message: directError.message,
          details: directError.details,
          hint: directError.hint
        });
        throw directError;
      }
      
      
      if (!directUpdate || directUpdate.length === 0) {
        throw new Error(`Template not found for user ${userId} and study type ${studyType}`);
      }
      
      // Verify the update by fetching it back
      const { data: verifyData, error: verifyError } = await supabase
        .from('templates')
        .select('agent_logic_2')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single();
      
      if (verifyError) {
        console.log('⚠️ Could not verify save:', verifyError);
      } else {
        console.log('✅ Verified save:', {
          hasData: !!verifyData?.agent_logic_2,
          dataKeys: verifyData?.agent_logic_2 ? Object.keys(verifyData.agent_logic_2) : []
        });
      }
      
      return { success: true, studyLogic: verifyData?.agent_logic_2 || studyLogic };
    } catch (error) {
      console.error('Error updating study logic v2:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Reset logic to defaults
  ipcMain.handle('reset-logic-v2', async (event, userId, studyType, resetType) => {
    try {
      if (!supabase) {
        initializeSupabase();
        if (!supabase) {
          throw new Error('Supabase not initialized');
        }
      }
      
      if (resetType === 'base') {
        // Reset base logic to defaults in user_default_logic table
        const { data: existing, error: checkError } = await supabase
          .from('user_default_logic')
          .select('id')
          .eq('user_id', userId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existing) {
          // Update existing row
          const { error } = await supabase
            .from('user_default_logic')
            .update({ 
              default_agent_logic: getDefaultBaseLogic(),
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          // Insert new row with defaults
          const { error } = await supabase
            .from('user_default_logic')
            .insert({ 
              user_id: userId,
              default_agent_logic: getDefaultBaseLogic(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (error) throw error;
        }
      } else {
        // Reset study logic to defaults
        const { error } = await supabase
          .from('templates')
          .update({ 
            agent_logic_2: getDefaultStudySpecificLogic(),
            agent_logic_2_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('study_type', studyType);
        
        if (error) throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error resetting logic v2:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Handler to fetch global base prompt
  ipcMain.handle('fetch-global-base-prompt', async () => {
    try {
      console.log('📝 Fetching global base prompt...');
      
      // Re-initialize with current session if needed
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available',
          basePrompt: null
        };
      }
      
      // Fetch global base prompt from global_base_prompt table
      const { data, error } = await supabase
        .from('global_base_prompt')
        .select('base_prompt, updated_at')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.error('Error fetching global base prompt:', error);
        
        // If not found, return null (will use hardcoded default)
        if (error.code === 'PGRST116') {
          console.log('No global base prompt found in database');
          return {
            success: true,
            basePrompt: null
          };
        }
        
        return {
          success: false,
          error: error.message,
          basePrompt: null
        };
      }
      
      if (data && data.base_prompt) {
        console.log('✅ Global base prompt fetched successfully');
        return {
          success: true,
          basePrompt: data.base_prompt,
          updatedAt: data.updated_at
        };
      }
      
      // No base prompt found
      return {
        success: true,
        basePrompt: null
      };
      
    } catch (error) {
      console.error('Error in fetch-global-base-prompt:', error);
      return {
        success: false,
        error: error.message,
        basePrompt: null
      };
    }
  });
  
  // Handler to update global base prompt (tier 4 only)
  ipcMain.handle('update-global-base-prompt', async (event, userId, newPrompt) => {
    try {
      console.log('📝 Updating global base prompt for user:', userId);
      
      // Re-initialize with current session
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available'
        };
      }
      
      // First check if user is tier 4 from user_subscriptions table
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .single();
      
      if (subError) {
        console.error('Error fetching user subscription:', subError);
        // If no subscription record, user is tier 1 by default
        if (subError.code === 'PGRST116') {
          return {
            success: false,
            error: 'Only tier 5+ users can update the global base prompt'
          };
        }
        return {
          success: false,
          error: 'Could not verify user permissions'
        };
      }
      
      const userTier = subscription?.tier || 1;
      if (userTier < 5) {
        return {
          success: false,
          error: 'Only tier 5+ users can update the global base prompt'
        };
      }
      
      // Update the global prompt in the global_base_prompt table
      const { data, error, status } = await supabase
        .from('global_base_prompt')
        .update({
          base_prompt: newPrompt,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)
        .select();
      
      console.log('Update result:', { data, error, status });
      
      if (error) {
        console.error('Error updating global base prompt:', error);
        // Check if it's a table not found error
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return {
            success: false,
            error: 'The global_base_prompt table does not exist. Please run the migration first.'
          };
        }
        return {
          success: false,
          error: error.message || 'Failed to update global base prompt'
        };
      }
      
      // Check if any rows were updated
      if (!data || data.length === 0) {
        console.error('No rows updated - table might be empty');
        return {
          success: false,
          error: 'No global base prompt found to update. The table might be empty.'
        };
      }
      
      console.log('✅ Global base prompt updated successfully');
      return {
        success: true,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error in update-global-base-prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Handler to fetch global impression base prompt
  ipcMain.handle('fetch-global-impression-prompt', async () => {
    try {
      console.log('📝 Fetching global impression base prompt...');
      
      // Re-initialize with current session if needed
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available',
          impressionPrompt: null
        };
      }
      
      // Fetch global impression prompt from global_base_prompt table
      const { data, error } = await supabase
        .from('global_base_prompt')
        .select('impression_base_prompt, updated_at')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.error('Error fetching global impression prompt:', error);
        
        // If column doesn't exist yet, return default
        if (error.message && error.message.includes('column')) {
          console.log('Impression prompt column not found, returning default');
          return {
            success: true,
            impressionPrompt: 'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.'
          };
        }
        
        return {
          success: false,
          error: error.message,
          impressionPrompt: null
        };
      }
      
      if (!data) {
        console.log('No global impression prompt found');
        return {
          success: true,
          impressionPrompt: null
        };
      }
      
      console.log('✅ Global impression prompt fetched successfully');
      return {
        success: true,
        impressionPrompt: data.impression_base_prompt || 'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.',
        updatedAt: data.updated_at
      };
      
    } catch (error) {
      console.error('Error in fetch-global-impression-prompt:', error);
      
      // Return default on error
      return {
        success: true,
        impressionPrompt: 'You are an expert radiologist generating a concise, clinically relevant impression based on imaging findings.'
      };
    }
  });
  
  // Handler to update global impression base prompt (tier 4 only)
  ipcMain.handle('update-global-impression-prompt', async (event, userId, newPrompt) => {
    try {
      console.log('📝 Updating global impression prompt for user:', userId);
      
      // Re-initialize with current session
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available'
        };
      }
      
      // First check if user is tier 4 from user_subscriptions table
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .single();
      
      let userTier = 1; // Default tier
      
      if (!subError && subscription) {
        userTier = subscription.tier;
      }
      
      if (userTier < 5) {
        console.log('User is not tier 5+, cannot update global impression prompt');
        return {
          success: false,
          error: 'Only tier 5+ users can update the global impression prompt'
        };
      }
      
      // Update the global impression prompt
      const { data, error } = await supabase
        .from('global_base_prompt')
        .update({
          impression_base_prompt: newPrompt,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)
        .select();
      
      if (error) {
        console.error('Error updating global impression prompt:', error);
        
        // If column doesn't exist, inform user to run migration
        if (error.message && error.message.includes('column')) {
          return {
            success: false,
            error: 'Database migration needed. Please run the latest migration to add impression prompt support.'
          };
        }
        
        return {
          success: false,
          error: error.message
        };
      }
      
      console.log('✅ Global impression prompt updated successfully');
      return {
        success: true,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error in update-global-impression-prompt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler to fetch all global prompt sections
  ipcMain.handle('fetch-global-prompt-sections', async () => {
    try {
      console.log('📝 Fetching all global prompt sections...');
      
      // Re-initialize with current session if needed
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available'
        };
      }
      
      // Get the current user from the store
      let userId = global.currentUser;
      
      // Extract ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      console.log('📝 Fetching global prompt sections for user:', userId);
      
      if (!userId) {
        console.log('No user ID available');
        return {
          success: false,
          error: 'User not authenticated'
        };
      }
      
      const { data, error } = await supabase
        .rpc('get_global_prompt_sections', { p_user_id: userId });
      
      console.log('📝 Global prompt sections data:', data);
      
      if (error) {
        console.error('Error fetching global prompt sections:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      return {
        success: true,
        reportBasePrompt: data[0]?.report_base_prompt || null,
        impressionBasePrompt: data[0]?.impression_base_prompt || null,
        globalFindingsRules: data[0]?.global_findings_rules || null,
        globalImpressionRules: data[0]?.global_impression_rules || null
      };
      
    } catch (error) {
      console.error('Error in fetch-global-prompt-sections:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler to update global findings rules
  ipcMain.handle('update-global-findings-rules', async (event, userId, rules) => {
    try {
      // Extract ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      console.log('📝 Updating global findings rules for user:', userId);
      console.log('📝 Rules being saved:', rules);
      
      // Re-initialize with current session
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available'
        };
      }
      
      const { error } = await supabase
        .rpc('update_global_findings_rules', { 
          p_user_id: userId,
          p_rules: rules 
        });
      
      if (error) {
        console.error('Error updating global findings rules:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      return {
        success: true,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error in update-global-findings-rules:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler to update global impression rules
  ipcMain.handle('update-global-impression-rules', async (event, userId, rules) => {
    try {
      // Extract ID if it's an object
      if (userId && typeof userId === 'object') {
        userId = userId.id || userId;
      }
      
      console.log('📝 Updating global impression rules for user:', userId);
      console.log('📝 Rules being saved:', rules);
      
      // Re-initialize with current session
      initializeSupabase();
      
      if (!supabase) {
        console.error('Supabase client not initialized');
        return {
          success: false,
          error: 'Database connection not available'
        };
      }
      
      const { error } = await supabase
        .rpc('update_global_impression_rules', { 
          p_user_id: userId,
          p_rules: rules 
        });
      
      if (error) {
        console.error('Error updating global impression rules:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      return {
        success: true,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error in update-global-impression-rules:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = { registerAgentLogicV2Handlers, getDefaultStudySpecificLogic, getDefaultBaseLogic };