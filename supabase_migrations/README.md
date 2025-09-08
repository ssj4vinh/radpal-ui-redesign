# Supabase Migration Instructions

## Adding User Profile Columns to user_subscriptions Table

### Migration File: `add_user_profile_columns.sql`

This migration adds first_name, last_name, and email columns to the user_subscriptions table.

### How to Apply the Migration

1. **Option 1: Via Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor
   - Copy and paste the contents of `add_user_profile_columns.sql`
   - Click "Run" to execute the migration

2. **Option 2: Via Supabase CLI**
   ```bash
   supabase db push --file supabase_migrations/add_user_profile_columns.sql
   ```

3. **Option 3: Manual via SQL Editor**
   - Connect to your database using any PostgreSQL client
   - Execute the SQL commands in the migration file

### What This Migration Does

- Adds `first_name` (TEXT) column to store user's first name
- Adds `last_name` (TEXT) column to store user's last name  
- Adds `email` (TEXT) column to store user's email address
- Creates an index on the email column for faster lookups
- Adds column comments for documentation

### Features Added to the Application

After applying this migration, the application will:

1. **Auto-sync user email** - When a user logs in, their email is automatically synced to the user_subscriptions table
2. **Profile management** - Users can edit their first name, last name, and email through the UserProfileEditor component
3. **Profile hooks** - The `useUserProfile` hook provides easy access to user profile data throughout the app

### Usage in the Application

```typescript
// Import the hook
import { useUserProfile } from './hooks/useUserProfile';

// Use in a component
const { profile, loading, error, updateProfile } = useUserProfile(user.id);

// Update profile
await updateProfile({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com'
});
```

### Rollback Instructions

If you need to rollback this migration:

```sql
ALTER TABLE user_subscriptions 
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS email;

DROP INDEX IF EXISTS idx_user_subscriptions_email;
```