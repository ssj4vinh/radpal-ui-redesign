-- Create macros table for voice command macros
CREATE TABLE IF NOT EXISTS public.macros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'picklist')),
    value_text TEXT,
    options JSONB,
    scope VARCHAR(50) DEFAULT 'global' CHECK (scope IN ('global', 'findings', 'impression')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Add constraint to ensure text macros have valueText and picklist macros have options
    CONSTRAINT macro_value_check CHECK (
        (type = 'text' AND value_text IS NOT NULL) OR
        (type = 'picklist' AND options IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX idx_macros_user_id ON public.macros(user_id);
CREATE INDEX idx_macros_name ON public.macros(name);
CREATE INDEX idx_macros_user_name ON public.macros(user_id, LOWER(name));
CREATE INDEX idx_macros_scope ON public.macros(scope);

-- Enable RLS
ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own macros" ON public.macros
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own macros" ON public.macros
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own macros" ON public.macros
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own macros" ON public.macros
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
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