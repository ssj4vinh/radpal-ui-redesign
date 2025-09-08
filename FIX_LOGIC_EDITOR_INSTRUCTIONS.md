# Fix Logic Editor Save Issues

## Problem
1. Cannot save base logic - error: "new row violates row-level security policy for table user_default_logic"
2. Study logic appears to save but changes don't persist

## Solution - Run these SQL commands in Supabase

### Step 1: Fix RLS Policies for user_default_logic table

Run the contents of `/supabase/fix_user_default_logic_rls.sql` in your Supabase SQL editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `fix_user_default_logic_rls.sql`
4. Click "Run"

This will:
- Create the `user_default_logic` table if it doesn't exist
- Set up proper Row Level Security policies
- Allow users to insert, view, update, and delete their own logic

### Step 2: Ensure agent_logic_2 column exists in templates table

Run the contents of `/supabase/add_agent_logic_2_column.sql` in your Supabase SQL editor:

1. In the same SQL Editor
2. Copy and paste the contents of `add_agent_logic_2_column.sql`
3. Click "Run"

This will:
- Add the `agent_logic_2` column if it doesn't exist
- Add an updated timestamp column
- Set default values for existing rows

### Step 3: Restart the Electron app

After running the SQL commands:
1. Close the RadPal app completely
2. Run `npm run dev` again to restart
3. Log in and try saving logic again

## Verification

To verify the fixes worked, you can run this query in Supabase:

```sql
-- Check if user_default_logic table has proper RLS policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'user_default_logic';

-- Check if agent_logic_2 column exists
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'templates' 
AND column_name = 'agent_logic_2';
```

## Expected Results

After applying these fixes:
1. Base logic should save without RLS errors
2. Study-specific logic should persist after saving
3. The logic editor should properly load and save both base and study logic