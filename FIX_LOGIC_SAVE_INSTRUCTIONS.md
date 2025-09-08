# Fix Logic Editor Save Issues

## Problem
1. Base logic saving fails with RLS policy error: `new row violates row-level security policy for table "user_default_logic"`
2. Study-specific logic appears to save but changes don't persist

## Solution

### Step 1: Run the RLS Fix Migration in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Fix RLS policies for user_default_logic table
-- This script ensures users can properly insert and update their own logic

-- First, check if the table exists and create it if not
CREATE TABLE IF NOT EXISTS user_default_logic (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_agent_logic JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_default_logic ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can insert their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can update their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Users can delete their own default logic" ON user_default_logic;
DROP POLICY IF EXISTS "Enable all access for users based on user_id" ON user_default_logic;

-- Create a single comprehensive policy for all operations
-- This approach is more reliable for UPSERT operations
CREATE POLICY "Enable all access for users based on user_id"
    ON user_default_logic
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_default_logic_user_id ON user_default_logic(user_id);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_default_logic_updated_at ON user_default_logic;

CREATE TRIGGER update_user_default_logic_updated_at
    BEFORE UPDATE ON user_default_logic
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to authenticated users
GRANT ALL ON user_default_logic TO authenticated;

-- Also ensure the templates table has proper columns for agent_logic_2
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2 JSONB DEFAULT '{}'::jsonb;

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS agent_logic_2_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
```

### Step 2: Verify the Fix

After running the SQL above, test the logic editor:

1. Open the Logic Editor
2. Switch to "Base Logic" mode
3. Make a change (e.g., change Tone Style)
4. Click Save - should now work without RLS error
5. Switch to "Study-Specific Logic" mode  
6. Make a change (e.g., add a custom rule)
7. Click Save - should persist correctly
8. Refresh the page to verify changes were saved

### Step 3: Monitor Console Logs

Watch the browser console for these key messages:
- `📤 Saving base logic...` - Indicates base logic save attempt
- `📤 Saving study logic for: [study type]` - Indicates study logic save attempt
- `💾 Save result:` - Shows if save was successful
- `✅ Study logic updated successfully` - Confirms database update

## Technical Details

### What Was Fixed

1. **RLS Policy Issue**: The original RLS policies had separate INSERT and UPDATE policies which can conflict during UPSERT operations. The fix uses a single comprehensive policy for ALL operations.

2. **Missing Columns**: Added `agent_logic_2` and `agent_logic_2_updated_at` columns to the templates table if they don't exist.

3. **Permissions**: Ensured authenticated users have ALL permissions on the `user_default_logic` table.

## Troubleshooting

If issues persist:

1. Check if the user is properly authenticated:
   - Open browser console
   - Look for `auth.uid()` in error messages
   - Verify the user session is active

2. Verify table structure:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name IN ('user_default_logic', 'templates');
   ```

3. Check current RLS policies:
   ```sql
   SELECT policyname, cmd, qual, with_check 
   FROM pg_policies 
   WHERE tablename = 'user_default_logic';
   ```