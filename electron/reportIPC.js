const { ipcMain } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// Helper function to get authenticated Supabase client
function getAuthenticatedClient() {
  const session = global.supabaseSession;
  
  if (!session?.access_token) {
    throw new Error('No authenticated session available');
  }
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc';
  
  // Create client with user's access token for proper RLS
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  });
  
  return supabase;
}

// Helper function to handle Supabase errors
function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  return {
    success: false,
    error: error.message || 'An error occurred'
  };
}

// Save a new report
ipcMain.handle('report:save', async (event, report) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .insert([{
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Update an existing report
ipcMain.handle('report:update', async (event, { id, updates }) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Get a specific report
ipcMain.handle('report:get', async (event, id) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Get all reports for a user
ipcMain.handle('report:getUserReports', async (event, { userId, limit = 50, offset = 0 }) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Get reports by study type
ipcMain.handle('report:getByStudyType', async (event, { userId, studyType }) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('study_type', studyType)
      .order('created_at', { ascending: false });

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Delete a report
ipcMain.handle('report:delete', async (event, id) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) return handleSupabaseError(error);
    
    return {
      success: true
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

// Search reports
ipcMain.handle('report:search', async (event, { userId, searchTerm }) => {
  try {
    const supabase = getAuthenticatedClient();
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .or(`study_type.ilike.%${searchTerm}%,findings.ilike.%${searchTerm}%,initial_result.ilike.%${searchTerm}%,edited_result.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) return handleSupabaseError(error);
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return handleSupabaseError(error);
  }
});

module.exports = {
  setupReportIPC: () => {
    console.log('Report IPC handlers registered');
  }
};