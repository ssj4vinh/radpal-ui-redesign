-- Create user_subscriptions table for managing subscription tiers
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Add foreign key constraint to auth.users
    CONSTRAINT fk_user_id FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own subscription
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow authenticated users to insert their own subscription (for signup)
CREATE POLICY "Users can create own subscription" ON public.user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow updates (for future subscription changes)
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function to automatically create tier 1 subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_subscriptions (user_id, tier)
    VALUES (new.id, 1)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create subscription entry when a new user signs up
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_subscription();

-- Create function to get user tier (for easy access)
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_tier INTEGER;
BEGIN
    SELECT tier INTO v_tier
    FROM public.user_subscriptions
    WHERE user_id = p_user_id;
    
    -- Return tier 1 as default if no subscription found
    RETURN COALESCE(v_tier, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert tier 1 subscriptions for existing users who don't have one
INSERT INTO public.user_subscriptions (user_id, tier)
SELECT id, 1
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.user_subscriptions TO anon;