-- Create macros table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.macros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'picklist')),
    scope TEXT CHECK (scope IN ('global', 'findings', 'impression')),
    value_text TEXT,
    options TEXT[], -- Array for picklist options
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name, scope)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_macros_user_id ON public.macros(user_id);
CREATE INDEX IF NOT EXISTS idx_macros_name ON public.macros(name);
CREATE INDEX IF NOT EXISTS idx_macros_scope ON public.macros(scope);
CREATE INDEX IF NOT EXISTS idx_macros_user_name ON public.macros(user_id, name);

-- Enable Row Level Security (RLS)
ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own macros
CREATE POLICY "Users can view own macros" ON public.macros
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own macros
CREATE POLICY "Users can insert own macros" ON public.macros
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own macros
CREATE POLICY "Users can update own macros" ON public.macros
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own macros
CREATE POLICY "Users can delete own macros" ON public.macros
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_macros_updated_at BEFORE UPDATE ON public.macros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.macros TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Insert some example macros (optional - comment out if not needed)
-- INSERT INTO public.macros (user_id, name, type, scope, value_text) 
-- VALUES 
--   (auth.uid(), 'dimensions', 'text', 'global', '(CC x TRV x AP)'),
--   (auth.uid(), 'normal', 'text', 'global', 'No acute abnormality identified.'),
--   (auth.uid(), 'unremarkable', 'text', 'global', 'Unremarkable examination.');