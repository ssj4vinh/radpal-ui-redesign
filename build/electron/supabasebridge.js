// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config()
  } catch (e) {
    // dotenv not available in production, which is fine
  }
}

// Load config with fallback
let config;
try {
  config = require('./config');
} catch (e) {
  console.log('Config file not found in supabasebridge, using environment variables');
  config = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || '',
    DEEP_GRAM_API: process.env.DEEP_GRAM_API || ''
  };
}

// electron/supabaseBridge.js
const { ipcMain } = require('electron')
const { createClient } = require('@supabase/supabase-js')
const fetch = require('node-fetch')
const https = require('https')

// Import logic utility functions
function deepMergeAgentLogic(target, source) {
  if (!target || typeof target !== 'object') {
    return source
  }
  
  if (!source || typeof source !== 'object') {
    return target
  }

  const result = { ...target }

  for (const key in source) {
    if (!(key in source)) continue

    const sourceValue = source[key]
    const targetValue = result[key]

    if (Array.isArray(sourceValue)) {
      if (Array.isArray(targetValue)) {
        // Merge arrays, removing duplicates
        const combined = [...targetValue, ...sourceValue]
        result[key] = [...new Set(combined)]
      } else {
        result[key] = [...sourceValue]
      }
    } else if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      // Recursively merge objects
      result[key] = deepMergeAgentLogic(targetValue || {}, sourceValue)
    } else {
      // Primitive values - source overwrites target
      result[key] = sourceValue
    }
  }

  return result
}

function getDefaultAgentLogic() {
  return {
    version: "2.0",
    formatting: {
      preserve_template_punctuation: true,
      use_bullet_points: false,
      capitalize_sections: true
    },
    report: {
      no_hallucinated_findings: true,
      include_technique_section: false,
      expand_lesions: false
    },
    impression: {
      numerically_itemized: true,
      omit_minor_or_incidental_findings_unless_relevant: false,
      concise_summary: false,
      include_recommendations: false,
      first_item_should_address_clinical_concern: false,
      exclude_by_default: [],
      mention_muscle_atrophy_if: "any"
    },
    anatomy: {
      combine_meniscus_and_cartilage_findings: false,
      group_by_anatomic_region: false
    },
    clinical: {
      correlate_with_symptoms: false,
      mention_clinical_significance: false
    },
    measurements: {
      include_all_measurements: true,
      use_metric_system: true
    },
    severity: {
      use_standard_grading: false,
      avoid_vague_terms: false
    },
    style: {
      active_voice: false,
      professional_tone: true
    },
    custom_instructions: []
  }
}

// Create a custom agent that ignores certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Custom fetch that uses our agent
const customFetch = (url, options = {}) => {
  console.log('🔍 Custom fetch to:', url)
  return fetch(url, {
    ...options,
    agent: url.startsWith('https:') ? httpsAgent : undefined
  })
}

const supabaseUrl = config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

console.log('🔍 Initializing Supabase client with URL:', supabaseUrl)
console.log('🔍 Using anon key:', supabaseAnonKey?.substring(0, 20) + '...')

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
})

// Helper function to create authenticated client with custom fetch
function createAuthedClient(token) {
  return createClient(
    config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        },
        fetch: customFetch
      }
    }
  )
}

// console.log('🧪 Supabase URL (from VITE_):', process.env.VITE_SUPABASE_URL)

function registerSupabaseHandlers() {
  ipcMain.handle('fetch-templates', async (_event, userId, accessToken) => {
  console.log('📥 fetch-templates for user:', userId)

  // Use global session if no accessToken provided or if accessToken is invalid
  const session = global.supabaseSession
  const token = accessToken || session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for fetch-templates - user may need to sign in again')
    // Return empty templates instead of failing
    return {}
  }

  console.log('🔍 Using token for fetch-templates:', token?.substring(0, 20) + '...')

  const authedClient = createAuthedClient(token)

  try {
    const { data, error } = await authedClient
      .from('templates')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    // console.log('✅ Supabase returned templates:', data)

    const transformed = {}
    for (const row of data) {
      transformed[row.study_type] = {
        template: row.template,
        generate_prompt: row.generate_prompt,
        generate_impression: row.generate_impression,
        keywords: row.keywords || [] // Include keywords from database
      }
    }

    return transformed
  } catch (err) {
    console.error('❌ fetch-templates failed:', err)
    return {}
  }
})

// Single template fetch for generation (used by agent functions)
ipcMain.handle('fetch-template-for-generation', async (_event, userId, studyType) => {
  console.log('📥 fetch-template-for-generation for user:', userId, 'study type:', studyType)

  // Use global session
  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for fetch-template-for-generation')
    return { error: 'No authentication token available' }
  }

  console.log('🔍 Using token for fetch-template-for-generation:', token?.substring(0, 20) + '...')

  const authedClient = createAuthedClient(token)

  try {
    const { data, error } = await authedClient
      .from('templates')
      .select('template, agent_logic, generate_impression, generate_prompt')
      .eq('user_id', userId)
      .eq('study_type', studyType)
      .single()

    if (error) {
      console.error('❌ fetch-template-for-generation query error:', error)
      return { error: error.message }
    }

    if (!data) {
      console.error('❌ No template found for user:', userId, 'study type:', studyType)
      return { error: `No template found for user ${userId} and study type "${studyType}"` }
    }

    // Merge stored agent_logic with defaults to ensure all expected properties are present
    if (data.agent_logic) {
      const defaultLogic = getDefaultAgentLogic()
      const mergedLogic = deepMergeAgentLogic(defaultLogic, data.agent_logic)
      data.agent_logic = mergedLogic
      console.log('✅ Template found for generation with merged logic:', studyType)
      console.log('🔍 numerically_itemized in merged logic:', mergedLogic?.impression?.numerically_itemized)
    } else {
      // No stored logic, use defaults
      data.agent_logic = getDefaultAgentLogic()
      console.log('✅ Template found for generation with default logic:', studyType)
    }

    return { data }
  } catch (err) {
    console.error('❌ fetch-template-for-generation failed:', err)
    return { error: err.message || 'Template fetch failed' }
  }
})

// Chat Sessions IPC handlers
ipcMain.handle('chat-create-session', async (_event, reportId, studyType, reportSnapshot) => {
  console.log('📥 chat-create-session for reportId:', reportId)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for chat-create-session')
    return { error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    const sessionData = {
      user_id: user.id,
      report_id: reportId,
      study_type: studyType || null,
      report_snapshot: reportSnapshot || null,
      messages: []
    }

    const { data, error } = await authedClient
      .from('chat_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) throw error

    console.log('✅ Chat session created:', data.id)
    return { data, error: null }
  } catch (err) {
    console.error('❌ chat-create-session failed:', err)
    return { data: null, error: err.message || 'Failed to create chat session' }
  }
})

ipcMain.handle('chat-get-session', async (_event, sessionId) => {
  console.log('📥 chat-get-session for sessionId:', sessionId)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    const { data, error } = await authedClient
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (err) {
    console.error('❌ chat-get-session failed:', err)
    return { data: null, error: err.message || 'Failed to get chat session' }
  }
})

ipcMain.handle('chat-append-message', async (_event, sessionId, message) => {
  console.log('📥 chat-append-message for sessionId:', sessionId)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    // First get current session
    const { data: currentSession, error: getError } = await authedClient
      .from('chat_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    if (getError) throw getError

    // Append new message
    const updatedMessages = [...(currentSession.messages || []), message]

    const { data, error } = await authedClient
      .from('chat_sessions')
      .update({ 
        messages: updatedMessages,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (err) {
    console.error('❌ chat-append-message failed:', err)
    return { data: null, error: err.message || 'Failed to append message' }
  }
})

ipcMain.handle('chat-get-user-sessions', async (_event, limit = 10) => {
  console.log('📥 chat-get-user-sessions with limit:', limit)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Authentication failed')
    }

    const { data, error } = await authedClient
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return { data, error: null }
  } catch (err) {
    console.error('❌ chat-get-user-sessions failed:', err)
    return { data: null, error: err.message || 'Failed to get user sessions' }
  }
})

// Agent Logic IPC handlers
ipcMain.handle('agent-logic-update', async (_event, userId, studyType, delta) => {
  console.log('📥 agent-logic-update for user:', userId, 'study type:', studyType)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { success: false, error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    // Get current logic
    const { data, error } = await authedClient
      .from('templates')
      .select('agent_logic')
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (error) throw new Error(`Failed to fetch current logic: ${error.message}`)

    // Apply the delta to merge with current logic
    let currentLogic = data && data.length > 0 ? data[0]?.agent_logic || {} : {}
    
    // Simple merge logic - can be enhanced based on delta structure
    const finalLogic = { ...currentLogic, ...delta }

    // Update the logic
    const { error: updateError } = await authedClient
      .from('templates')
      .update({ agent_logic: finalLogic })
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (updateError) throw new Error(`Failed to update logic: ${updateError.message}`)

    console.log('✅ Agent logic updated via IPC')
    return { success: true, finalLogic }
  } catch (err) {
    console.error('❌ agent-logic-update failed:', err)
    return { success: false, error: err.message || 'Failed to update agent logic' }
  }
})

ipcMain.handle('agent-logic-reset', async (_event, userId, studyType) => {
  console.log('📥 agent-logic-reset for user:', userId, 'study type:', studyType)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { success: false, error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    // Reset to default logic (empty object)
    const defaultLogic = {}

    const { error } = await authedClient
      .from('templates')
      .update({ agent_logic: defaultLogic })
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (error) throw new Error(`Failed to reset logic: ${error.message}`)

    console.log('✅ Agent logic reset via IPC')
    return { success: true, finalLogic: defaultLogic }
  } catch (err) {
    console.error('❌ agent-logic-reset failed:', err)
    return { success: false, error: err.message || 'Failed to reset agent logic' }
  }
})

ipcMain.handle('agent-logic-get-current', async (_event, userId, studyType) => {
  console.log('📥 agent-logic-get-current for user:', userId, 'study type:', studyType)

  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    return { logic: null, error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    const { data, error } = await authedClient
      .from('templates')
      .select('agent_logic')
      .eq('user_id', userId)
      .eq('study_type', studyType.trim())

    if (error) throw new Error(`Failed to fetch logic: ${error.message}`)

    let logic
    if (!data || data.length === 0) {
      logic = {} // Default logic
    } else {
      logic = data[0]?.agent_logic || {}
    }

    return { logic }
  } catch (err) {
    console.error('❌ agent-logic-get-current failed:', err)
    return { logic: null, error: err.message || 'Failed to get current agent logic' }
  }
})

    ipcMain.handle('save-template', async (_event, { userId, accessToken, studyType, template, generatePrompt, generateImpression }) => {
  console.log('💾 save-template for user:', userId)

  // Use global session if no accessToken provided or if accessToken is invalid
  const session = global.supabaseSession
  const token = accessToken || session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for save-template')
    return { success: false }
  }

  console.log('🔍 Using token for save-template:', token?.substring(0, 20) + '...')

  const authedClient = createAuthedClient(token)

  try {
    const { error } = await authedClient
      .from('templates')
      .upsert({
        user_id: userId,
        study_type: studyType,
        template,
        generate_prompt: generatePrompt,
        generate_impression: generateImpression
      }, { onConflict: ['user_id', 'study_type'] })

    if (error) throw error

    // Notify all windows that templates have been updated
    console.log('🔄 Broadcasting templates-updated event to all windows')
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('templates-updated', { studyType, userId })
      }
    })

    return { success: true }
  } catch (err) {
    console.error('❌ save-template failed:', err)
    return { success: false }
  }
})

// Delete template
ipcMain.handle('delete-template', async (_event, { userId, studyType }) => {
  console.log('🗑️ delete-template for user:', userId, 'study type:', studyType)

  // Use global session
  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for delete-template')
    return { success: false, error: 'No authentication token available' }
  }

  const authedClient = createAuthedClient(token)

  try {
    // Delete the template
    const { error } = await authedClient
      .from('templates')
      .delete()
      .eq('user_id', userId)
      .eq('study_type', studyType)

    if (error) {
      console.error('❌ Delete template error:', error)
      return { success: false, error: error.message }
    }

    // Also delete associated agent logic if it exists
    const { error: logicError } = await authedClient
      .from('agent_logic')
      .delete()
      .eq('user_id', userId)
      .eq('study_type', studyType)

    if (logicError) {
      console.warn('⚠️ Could not delete agent logic:', logicError)
      // Continue anyway - template deletion is more important
    }

    console.log('✅ Template deleted successfully')
    
    // Notify main window about template update
    mainWindow?.webContents?.send('templates-updated', {
      studyType,
      deleted: true
    })

    return { success: true }
  } catch (err) {
    console.error('❌ delete-template failed:', err)
    return { success: false, error: err.message }
  }
})

// Save template with agent logic (for new study types)
ipcMain.handle('save-template-with-agent-logic', async (_event, { userId, studyType, template, agentLogic, keywords }) => {
  console.log('💾 save-template-with-agent-logic for user:', userId, 'study type:', studyType)
  console.log('🔑 Keywords:', keywords)

  // Use global session
  const session = global.supabaseSession
  const token = session?.access_token
  
  if (!token) {
    console.log('⚠️ No access token available for save-template-with-agent-logic')
    return { success: false, error: 'No authentication token available' }
  }

  console.log('🔍 Using token for save-template-with-agent-logic:', token?.substring(0, 20) + '...')

  const authedClient = createAuthedClient(token)

  try {
    // Save template with agent logic
    const { error } = await authedClient
      .from('templates')
      .upsert({
        user_id: userId,
        study_type: studyType,
        template,
        agent_logic: agentLogic,
        keywords: keywords || [], // Store keywords array
        generate_prompt: '', // Empty for new templates
        generate_impression: '' // Empty for new templates
      }, { onConflict: ['user_id', 'study_type'] })

    if (error) throw error

    // Notify all windows that templates have been updated
    console.log('🔄 Broadcasting templates-updated event to all windows')
    const { BrowserWindow } = require('electron')
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('templates-updated', { studyType, userId })
      }
    })

    console.log('✅ Template with agent logic saved successfully')
    return { success: true }
  } catch (err) {
    console.error('❌ save-template-with-agent-logic failed:', err)
    return { success: false, error: err.message }
  }
})

  // Handler to get current generate_prompt for a specific study type
  ipcMain.handle('get-template-prompt', async (_event, studyType) => {
    // console.log('📥 get-template-prompt for study type:', studyType)

    try {
      // Get current user and access token from session
      const user = global.currentUser
      const session = global.supabaseSession

      if (!user || !session) {
        console.error('❌ No user session available for get-template-prompt')
        return null
      }

      const userId = user.id
      const accessToken = session.access_token

      const authedClient = createAuthedClient(accessToken)

      const { data, error } = await authedClient
        .from('templates')
        .select('generate_prompt')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single()

      if (error) throw error

      return data?.generate_prompt || null
    } catch (err) {
      console.error('❌ get-template-prompt failed:', err)
      return null
    }
  })

  // Handler to update generate_prompt for a specific study type
  ipcMain.handle('update-template-prompt', async (_event, studyType, newPrompt) => {
    // console.log('💾 update-template-prompt for study type:', studyType)

    try {
      // Get current user and access token from session
      const user = global.currentUser
      const session = global.supabaseSession

      if (!user || !session) {
        console.error('❌ No user session available for update-template-prompt')
        return { success: false }
      }

      const userId = user.id
      const accessToken = session.access_token

      const authedClient = createAuthedClient(accessToken)

      const { error } = await authedClient
        .from('templates')
        .update({ generate_prompt: newPrompt })
        .eq('user_id', userId)
        .eq('study_type', studyType)

      if (error) throw error

      return { success: true }
    } catch (err) {
      console.error('❌ update-template-prompt failed:', err)
      return { success: false }
    }
  })

  // Handler to get current generate_impression for a specific study type
  ipcMain.handle('get-template-impression', async (_event, studyType) => {
    // console.log('📥 get-template-impression for study type:', studyType)

    try {
      // Get current user and access token from session
      const user = global.currentUser
      const session = global.supabaseSession

      if (!user || !session) {
        console.error('❌ No user session available for get-template-impression')
        return null
      }

      const userId = user.id
      const accessToken = session.access_token

      const authedClient = createAuthedClient(accessToken)

      const { data, error } = await authedClient
        .from('templates')
        .select('generate_impression')
        .eq('user_id', userId)
        .eq('study_type', studyType)
        .single()

      if (error) throw error

      return data?.generate_impression || null
    } catch (err) {
      console.error('❌ get-template-impression failed:', err)
      return null
    }
  })

  // Handler to update keywords for a specific study type
ipcMain.handle('update-template-keywords', async (_event, studyType, keywords) => {
  console.log('📝 update-template-keywords for study type:', studyType)
  
  try {
    // Get current user and access token from session
    const user = global.currentUser
    const session = global.supabaseSession
    
    if (!user || !session) {
      console.error('❌ No user session available for update-template-keywords')
      return { success: false }
    }
    
    const userId = user.id
    const accessToken = session.access_token
    
    const authedClient = createAuthedClient(accessToken)
    
    const { error } = await authedClient
      .from('templates')
      .update({ keywords: keywords || [] })
      .eq('user_id', userId)
      .eq('study_type', studyType)
    
    if (error) throw error
    
    return { success: true }
  } catch (err) {
    console.error('❌ update-template-keywords failed:', err)
    return { success: false }
  }
})

// Handler to update generate_impression for a specific study type
  ipcMain.handle('update-template-impression', async (_event, studyType, newPrompt) => {
    // console.log('💾 update-template-impression for study type:', studyType)

    try {
      // Get current user and access token from session
      const user = global.currentUser
      const session = global.supabaseSession

      if (!user || !session) {
        console.error('❌ No user session available for update-template-impression')
        return { success: false }
      }

      const userId = user.id
      const accessToken = session.access_token

      const authedClient = createAuthedClient(accessToken)

      const { error } = await authedClient
        .from('templates')
        .update({ generate_impression: newPrompt })
        .eq('user_id', userId)
        .eq('study_type', studyType)

      if (error) throw error

      return { success: true }
    } catch (err) {
      console.error('❌ update-template-impression failed:', err)
      return { success: false }
    }
  })

  // Handler to get user's token limit based on tier
  ipcMain.handle('get-user-token-limit', async (_event, userId) => {
    console.log('💰 Fetching token limit for user:', userId)

    try {
      // Get current session for auth
      const session = global.supabaseSession
      
      if (!session) {
        console.log('⚠️ No session available, using default token limit')
        return 20000 // Default to tier 1 limit
      }

      const authedClient = createClient(
        config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        }
      )

      // First, get the user's tier from user_subscriptions
      const { data: tierData, error: tierError } = await authedClient
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle() // Use maybeSingle to handle missing records gracefully

      if (tierError && tierError.code !== 'PGRST116') { // PGRST116 is "no rows found" which is ok
        console.error('⚠️ Error fetching user tier, defaulting to tier 1:', tierError)
        return 20000 // Default to tier 1 limit
      }

      // Convert to number in case it comes as a string from database
      const rawTier = tierData?.tier
      let tier = rawTier ? parseInt(rawTier) : 1
      
      // Validate tier is a valid number
      if (isNaN(tier) || tier < 1 || tier > 4) {
        console.log(`⚠️ Invalid tier value: ${rawTier}, defaulting to tier 1`)
        tier = 1
      }
      
      console.log(`🔍 Raw tier from DB: ${rawTier}, Parsed tier: ${tier}`)
      
      // Calculate token limit based on tier
      let tokenLimit;
      switch(tier) {
        case 1:
          tokenLimit = 20000;   // Free: 20k tokens/day
          break;
        case 2:
          tokenLimit = 150000;  // Pro: 150k tokens/day
          break;
        case 3:
          tokenLimit = 400000;  // Premium: 400k tokens/day
          break;
        case 4:
          tokenLimit = 999999999;  // Developer: Unlimited (using very large number)
          break;
        default:
          console.log(`⚠️ Unexpected tier value: ${tier}, defaulting to tier 1`)
          tokenLimit = 20000;   // Default to tier 1
      }

      console.log(`✅ User tier: ${tier}, Token limit: ${tokenLimit}`)
      return tokenLimit
    } catch (err) {
      console.error('❌ get-user-token-limit failed:', err)
      return 20000 // Default to tier 1 limit on error
    }
  })

  // Handler to get user's subscription tier
  ipcMain.handle('get-user-tier', async (_event, userId) => {
    console.log('🎯 Fetching subscription tier for user:', userId)

    try {
      // Get current session for auth
      const session = global.supabaseSession
      
      if (!session) {
        console.log('⚠️ No session available, defaulting to tier 1')
        return 1
      }

      const authedClient = createClient(
        config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          }
        }
      )

      const { data, error } = await authedClient
        .from('user_subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle() // Use maybeSingle to handle missing records gracefully

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found" which is ok
        console.error('⚠️ Error fetching user tier, defaulting to tier 1:', error)
        return 1
      }

      // Convert to number in case it comes as a string from database
      const rawTier = data?.tier
      let tier = rawTier ? parseInt(rawTier) : 1
      
      // Validate tier is a valid number
      if (isNaN(tier) || tier < 1 || tier > 4) {
        console.log(`⚠️ Invalid tier value: ${rawTier}, defaulting to tier 1`)
        tier = 1
      }
      
      console.log(`✅ User subscription - Raw tier: ${rawTier}, Parsed tier: ${tier}`)
      return tier
    } catch (err) {
      console.error('❌ get-user-tier failed, defaulting to tier 1:', err)
      return 1
    }
  })

  // Authentication handlers
  ipcMain.handle('auth-sign-in', async (_event, email, password) => {
    console.log('🔐 Auth sign-in for:', email)
    console.log('🔍 Supabase URL:', supabaseUrl)
    console.log('🔍 Auth endpoint would be:', `${supabaseUrl}/auth/v1/token?grant_type=password`)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Supabase auth error:', error)
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          name: error.name,
          stack: error.stack
        })
        
        // Check for specific error types
        if (error.message?.includes('fetch failed') || 
            error.message?.includes('NetworkError') ||
            error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('ETIMEDOUT') ||
            error.message?.includes('ENOTFOUND') ||
            error.message?.includes('self signed certificate') ||
            error.message?.includes('unable to verify') ||
            error.message?.includes('certificate')) {
          return { data: null, error: 'Network error - please check your internet connection and firewall settings' }
        }
        return { data: null, error: error.message || 'Sign-in failed' }
      }

      // Store session globally
      global.supabaseSession = data.session
      global.currentUser = data.user

      // Check if this user needs template copying (first login after email confirmation)
      if (data.user?.id) {
        try {
          // Check template_copy_queue for pending items
          const { data: queueData } = await supabase
            .from('template_copy_queue')
            .select('status')
            .eq('user_id', data.user.id)
            .single()
          
          if (queueData?.status === 'pending') {
            console.log('📋 Processing pending template copy for user:', data.user.id)
            
            // Update queue status
            await supabase
              .from('template_copy_queue')
              .update({ status: 'processing' })
              .eq('user_id', data.user.id)
            
            // Trigger template copy
            const { triggerTemplateCopy } = require('./templateSeeder')
            await triggerTemplateCopy(data.user.id)
            
            // Mark as completed
            await supabase
              .from('template_copy_queue')
              .update({ 
                status: 'completed',
                processed_at: new Date().toISOString()
              })
              .eq('user_id', data.user.id)
            
            console.log('✅ Template copy completed for user:', data.user.id)
          }
        } catch (queueErr) {
          // Queue table might not exist or no pending items - that's ok
          console.log('📋 No pending template copy:', queueErr.message)
        }
      }

      console.log('✅ Sign-in successful for:', email)
      console.log('🔍 Session access token:', data.session?.access_token?.substring(0, 20) + '...')
      console.log('🔍 User ID:', data.user?.id)
      
      return { data, error: null }
    } catch (err) {
      console.error('❌ auth-sign-in failed with exception:', err)
      console.error('❌ Exception details:', {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack
      })
      
      // Handle all network-related errors
      if (err.message?.includes('fetch failed') || 
          err.message?.includes('NetworkError') ||
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('ETIMEDOUT') ||
          err.message?.includes('ENOTFOUND') ||
          err.message?.includes('self signed certificate') ||
          err.message?.includes('unable to verify') ||
          err.message?.includes('certificate') ||
          err.code === 'ECONNREFUSED' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND') {
        return { data: null, error: 'Network error - please check your internet connection and firewall settings' }
      }
      return { data, error: err.message || 'Sign-in failed' }
    }
  })

  ipcMain.handle('auth-sign-up', async (_event, email, password) => {
    console.log('🔐 Auth sign-up for:', email)
    
    try {
      // For email confirmation redirect, we'll use the Supabase URL with a success page
      // or you can set up a custom domain redirect
      const emailRedirectTo = `${process.env.VITE_SUPABASE_URL}` // This will show Supabase's default success page
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectTo,
          data: {
            email_confirm: true
          }
        }
      })

      if (error) throw error

      // Debug what Supabase returned
      console.log('🔍 Sign-up response:', {
        hasSession: !!data.session,
        hasUser: !!data.user,
        userId: data.user?.id,
        userEmail: data.user?.email,
        emailConfirmedAt: data.user?.email_confirmed_at,
        confirmationSentAt: data.user?.confirmation_sent_at
      })

      // Check if email confirmation is required
      // When email confirmation is enabled in Supabase:
      // - data.user will exist but email_confirmed_at will be null
      // - data.session will be null until email is confirmed
      const confirmationRequired = !data.session && data.user
      
      if (confirmationRequired) {
        console.log('📧 Email confirmation required for:', email)
        return { 
          data, 
          error: null,
          confirmationRequired: true,
          message: 'Please check your email to confirm your account'
        }
      }

      // Store session globally if immediate sign-in (email confirmation disabled in Supabase)
      if (data.session) {
        console.log('⚠️ Email confirmation appears to be DISABLED in Supabase settings')
        console.log('⚠️ User can log in immediately without confirming email')
        global.supabaseSession = data.session
        global.currentUser = data.user
      }

      console.log('✅ Sign-up successful for:', email)
      return { data, error: null, confirmationRequired: false }
    } catch (err) {
      console.error('❌ auth-sign-up failed:', err)
      return { data: null, error: err.message || 'Sign-up failed' }
    }
  })

  ipcMain.handle('auth-sign-out', async (_event) => {
    console.log('🔐 Auth sign-out')
    
    try {
      const { error } = await supabase.auth.signOut()

      if (error) throw error

      // Clear global session
      global.supabaseSession = null
      global.currentUser = null

      console.log('✅ Sign-out successful')
      return { error: null }
    } catch (err) {
      console.error('❌ auth-sign-out failed:', err)
      return { error: err.message || 'Sign-out failed' }
    }
  })

  ipcMain.handle('auth-get-session', async (_event) => {
    console.log('🔐 Auth get-session')
    
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error

      // Update global session
      global.supabaseSession = data.session
      
      // Initialize macrosIPC with the session if available
      const macrosIPC = require('./macrosIPC');
      if (data.session && macrosIPC) {
        macrosIPC.initSupabase(data.session);
        console.log('🔄 Updated macrosIPC with current session');
      }
      
      if (data.session?.user) {
        global.currentUser = data.session.user
        console.log('✅ Get session successful: session found for', data.session.user.email)
        console.log('🔍 Session token:', data.session.access_token?.substring(0, 20) + '...')
      } else {
        // If no session, clear the current user to prevent inconsistent state
        global.currentUser = null
        console.log('✅ Get session successful: no session, cleared current user')
      }

      return { data, error: null }
    } catch (err) {
      console.error('❌ auth-get-session failed:', err)
      // Clear global state on error
      global.supabaseSession = null
      global.currentUser = null
      return { data: { session: null }, error: err.message || 'Get session failed' }
    }
  })

  ipcMain.handle('auth-get-user', async (_event) => {
    console.log('🔐 Auth get-user')
    
    try {
      const { data, error } = await supabase.auth.getUser()

      if (error) throw error

      // Update global user
      if (data.user) {
        global.currentUser = data.user
      }

      console.log('✅ Get user successful:', data.user ? 'user found' : 'no user')
      return { data, error: null }
    } catch (err) {
      console.error('❌ auth-get-user failed:', err)
      return { data: { user: null }, error: err.message || 'Get user failed' }
    }
  })

  // Test connectivity handler
  ipcMain.handle('test-supabase-connection', async (_event) => {
    console.log('🔍 Testing Supabase connection...')
    
    try {
      // Try a simple query that doesn't require authentication
      const { data, error } = await supabase.from('templates').select('count', { count: 'exact', head: true })
      
      if (error) {
        console.error('❌ Supabase connection test failed:', error)
        return { success: false, error: error.message }
      }
      
      console.log('✅ Supabase connection test successful')
      return { success: true }
    } catch (err) {
      console.error('❌ Supabase connection test error:', err)
      return { success: false, error: err.message || 'Connection test failed' }
    }
  })

  // Authentication state change setup (called once from renderer)
  let authSubscription = null; // Track subscription to prevent multiple listeners
  
  ipcMain.handle('auth-setup-listener', async (_event) => {
    console.log('🔐 Setting up auth state change listener')
    
    // If already set up, don't create another one
    if (authSubscription) {
      console.log('🔍 Auth listener already exists, skipping setup')
      return { success: true, subscription: 'existing' }
    }
    
    try {
      // Set up the auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth state change:', event, session?.user?.email)
        console.log('🔍 Broadcasting auth state change to all windows')
        
        // Update global state
        global.supabaseSession = session
        global.currentUser = session?.user || null
        
        // Update macrosIPC with the new session
        const macrosIPC = require('./macrosIPC');
        if (session && macrosIPC) {
          macrosIPC.initSupabase(session);
          console.log('🔄 Updated macrosIPC with new auth session');
        }

        // Broadcast to all renderer processes
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        console.log('🔍 Found', windows.length, 'windows to broadcast to')
        
        windows.forEach((win, index) => {
          if (!win.isDestroyed()) {
            console.log(`🔍 Sending auth-state-change to window ${index}`)
            win.webContents.send('auth-state-change', { event, session })
          }
        })
      })

      authSubscription = subscription
      console.log('✅ Auth listener setup successful')
      return { success: true, subscription: subscription?.id }
    } catch (err) {
      console.error('❌ auth-setup-listener failed:', err)
      return { success: false, error: err.message || 'Listener setup failed' }
    }
  })

  // Handler for checking invite codes
  ipcMain.handle('check-invite-code', async (_event, inviteCode) => {
    console.log('🔍 Checking invite code:', inviteCode)
    
    try {
      // Normalize the code to uppercase for comparison
      const normalizedCode = inviteCode.trim().toUpperCase()
      console.log('🔍 Normalized code:', normalizedCode)
      
      // First, let's debug - check ALL codes in the table
      const { data: allCodes, error: allError } = await supabase
        .from('invite_codes')
        .select('code')
        .limit(10)
      
      console.log('📋 Sample of codes in database:', allCodes?.map(c => c.code))
      
      // Now check if the specific code exists (case-insensitive using ilike)
      const { data: codeExists, error: existsError } = await supabase
        .from('invite_codes')
        .select('code, used_by')
        .ilike('code', normalizedCode)
        .maybeSingle()
      
      if (existsError) {
        console.error('❌ Error checking if code exists:', existsError)
        // Also try with service role to bypass RLS
        console.log('🔄 Attempting with service role...')
        
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceRoleKey) {
          console.error('❌ No service role key available, cannot bypass RLS')
          console.log('💡 You need to fix RLS policies or add SUPABASE_SERVICE_ROLE_KEY to .env')
          return { data: null, error: 'RLS blocking access - run SQL fixes' }
        }
        
        const serviceClient = createClient(
          process.env.VITE_SUPABASE_URL,
          serviceRoleKey
        )
        
        const { data: serviceData, error: serviceError } = await serviceClient
          .from('invite_codes')
          .select('code, used_by')
          .ilike('code', normalizedCode)
          .maybeSingle()
        
        if (serviceError) {
          console.error('❌ Service role also failed:', serviceError)
          return { data: null, error: serviceError.message }
        }
        
        if (serviceData) {
          console.log('✅ Found with service role:', serviceData)
          codeExists = serviceData
        }
      }
      
      if (!codeExists) {
        console.log('❌ Invite code does not exist:', inviteCode, 'or', upperCode)
        console.log('💡 Make sure to add the code to the database first')
        return { data: null, error: 'Invite code not found' }
      }
      
      if (codeExists.used_by !== null) {
        console.log('❌ Invite code already used:', codeExists.code, 'by user:', codeExists.used_by)
        return { data: null, error: 'Invite code already used' }
      }
      
      console.log('✅ Invite code is valid and available:', codeExists.code)
      return { data: codeExists, error: null }
    } catch (err) {
      console.error('❌ check-invite-code failed:', err)
      return { data: null, error: err.message || 'Failed to check invite code' }
    }
  })

  // Handler for updating invite code as used with user profile info
  ipcMain.handle('mark-invite-code-used', async (_event, { inviteCode, userId, email, firstName, lastName }) => {
    const normalizedCode = inviteCode.trim().toUpperCase()
    console.log('✅ Marking invite code as used:', normalizedCode, 'by user:', userId)
    
    try {
      // Update invite code with user information
      const updateData = {
        used_by: userId,
        used_at: new Date().toISOString()
      };
      
      // Add optional fields if provided
      if (email) updateData.email = email;
      if (firstName) updateData.first_name = firstName;
      if (lastName) updateData.last_name = lastName;
      
      const { error } = await supabase
        .from('invite_codes')
        .update(updateData)
        .ilike('code', normalizedCode)

      if (error) {
        console.error('❌ Error updating invite code:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ Invite code marked as used with user info')
      return { success: true, error: null }
    } catch (err) {
      console.error('❌ mark-invite-code-used failed:', err)
      return { success: false, error: err.message || 'Failed to update invite code' }
    }
  })

  // Handler for checking if user exists in users table
  ipcMain.handle('check-user-exists', async (_event, userId) => {
    console.log('🔍 Checking if user exists:', userId)
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('❌ Error checking user:', error)
        return { exists: false, error: error.message }
      }

      return { exists: !!data?.id, error: null }
    } catch (err) {
      console.error('❌ check-user-exists failed:', err)
      return { exists: false, error: err.message || 'Failed to check user' }
    }
  })

  // Handler for triggering template copy (edge function call)
  ipcMain.handle('trigger-template-copy', async (_event, userId) => {
    console.log('📋 Triggering template copy for user:', userId)
    
    try {
      const response = await customFetch('https://ynzikfmpzhtohwsfniqv.functions.supabase.co/copy_default_templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hook-Secret': config.VITE_HOOK_SECRET || process.env.VITE_HOOK_SECRET || '',
        },
        body: JSON.stringify({ user: { id: userId } })
      })

      console.log('📬 Template copy response status:', response.status)
      const result = await response.text()
      console.log('📥 Template copy result:', result)

      return { success: response.ok, result }
    } catch (err) {
      console.error('❌ trigger-template-copy failed:', err)
      return { success: false, error: err.message || 'Failed to trigger template copy' }
    }
  })
    
}



module.exports = { registerSupabaseHandlers }
