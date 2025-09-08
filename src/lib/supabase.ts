import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,  // Disable session persistence since we use IPC bridge
      autoRefreshToken: false // Disable auto-refresh since main process handles auth
    }
  }
)
