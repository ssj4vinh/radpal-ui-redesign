const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let currentSession = null;

// Initialize or update Supabase client with session
function initSupabase(session) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    return null;
  }

  currentSession = session;
  
  if (session?.access_token) {
    // Create authenticated client
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }
    });
    console.log('✅ Supabase client initialized with auth token for macros');
  } else {
    // Create unauthenticated client
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('⚠️ Supabase client initialized without auth token for macros');
  }
  
  return supabase;
}

// List macros
async function listMacros(userId, scope) {
  console.log('📋 Listing macros:', { userId, scope, hasSession: !!currentSession });
  
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }
  
  try {
    let query = supabase
      .from('macros')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    
    if (scope) {
      // Include both the specific scope and global macros
      query = query.or(`scope.eq.${scope},scope.eq.global,scope.is.null`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error listing macros:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ Listed ${data?.length || 0} macros`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Exception listing macros:', error);
    return { success: false, error: error.message };
  }
}

// Get macro by name
async function getMacro(userId, name) {
  console.log('🔍 Getting macro:', { userId, name });
  
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }
  
  try {
    const { data, error } = await supabase
      .from('macros')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error getting macro:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ Exception getting macro:', error);
    return { success: false, error: error.message };
  }
}

// Save macro
async function saveMacro(macro) {
  console.log('💾 Saving macro:', { 
    name: macro.name, 
    userId: macro.user_id,
    value: macro.value,
    type: macro.type,
    scope: macro.scope,
    hasSession: !!currentSession,
    hasToken: !!currentSession?.access_token 
  });
  
  // Validate required fields
  if (!macro.value && !macro.value_text) {
    console.error('❌ Macro value_text is required but missing');
    return { success: false, error: 'Macro value_text is required' };
  }
  
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }
  
  if (!currentSession?.access_token) {
    console.error('❌ No auth token available for saving macro');
    return { success: false, error: 'Authentication required' };
  }
  
  try {
    // First check if macro exists
    const { data: existing } = await supabase
      .from('macros')
      .select('id')
      .eq('user_id', macro.user_id)
      .eq('name', macro.name)
      .maybeSingle();
    
    let result;
    if (existing) {
      // Update existing macro
      const { data, error } = await supabase
        .from('macros')
        .update({
          value_text: macro.value_text || macro.value || '',
          type: macro.type,
          scope: macro.scope,
          description: macro.description,
          options: macro.options,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      result = { data, error };
      console.log('📝 Updating existing macro');
    } else {
      // Insert new macro
      const { data, error } = await supabase
        .from('macros')
        .insert({
          user_id: macro.user_id,
          name: macro.name,
          value_text: macro.value_text || macro.value || '',
          type: macro.type,
          scope: macro.scope,
          description: macro.description,
          options: macro.options,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      result = { data, error };
      console.log('✨ Creating new macro');
    }
    
    if (result.error) {
      console.error('❌ Error saving macro:', result.error);
      return { success: false, error: result.error.message };
    }
    
    console.log('✅ Macro saved successfully');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('❌ Exception saving macro:', error);
    return { success: false, error: error.message };
  }
}

// Delete macro
async function deleteMacro(userId, macroId) {
  console.log('🗑️ Deleting macro:', { userId, macroId });
  
  if (!supabase) {
    return { success: false, error: 'Supabase not initialized' };
  }
  
  if (!currentSession?.access_token) {
    return { success: false, error: 'Authentication required' };
  }
  
  try {
    const { error } = await supabase
      .from('macros')
      .delete()
      .eq('id', macroId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('❌ Error deleting macro:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Macro deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Exception deleting macro:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initSupabase,
  listMacros,
  getMacro,
  saveMacro,
  deleteMacro
};