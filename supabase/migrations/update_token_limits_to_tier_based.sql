-- Update token limits to be tier-based instead of user_profiles based

-- Create function to get token limit based on tier
CREATE OR REPLACE FUNCTION public.get_user_token_limit(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_tier INTEGER;
    v_token_limit INTEGER;
BEGIN
    -- Get user's tier
    SELECT tier INTO v_tier
    FROM public.user_subscriptions
    WHERE user_id = p_user_id;
    
    -- If no subscription found, default to tier 1
    v_tier := COALESCE(v_tier, 1);
    
    -- Calculate token limit based on tier
    CASE v_tier
        WHEN 1 THEN v_token_limit := 20000;   -- Free: 20k tokens/day
        WHEN 2 THEN v_token_limit := 150000;  -- Pro: 150k tokens/day
        WHEN 3 THEN v_token_limit := 400000;  -- Premium: 400k tokens/day
        WHEN 4 THEN v_token_limit := 999999999;  -- Developer: Unlimited
        ELSE v_token_limit := 20000;          -- Default to tier 1
    END CASE;
    
    RETURN v_token_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for easy access to user limits with tier info
CREATE OR REPLACE VIEW public.user_token_limits AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(us.tier, 1) as tier,
    CASE 
        WHEN COALESCE(us.tier, 1) = 1 THEN 'Free'
        WHEN COALESCE(us.tier, 1) = 2 THEN 'Pro'
        WHEN COALESCE(us.tier, 1) = 3 THEN 'Premium'
        WHEN COALESCE(us.tier, 1) = 4 THEN 'Developer'
        ELSE 'Free'
    END as tier_name,
    CASE COALESCE(us.tier, 1)
        WHEN 1 THEN 20000
        WHEN 2 THEN 150000
        WHEN 3 THEN 400000
        WHEN 4 THEN 999999999  -- Unlimited
        ELSE 20000
    END as daily_token_limit
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id;

-- Grant permissions on the view
GRANT SELECT ON public.user_token_limits TO authenticated;
GRANT SELECT ON public.user_token_limits TO anon;

-- Add RLS policy for the view (users can only see their own data)
ALTER VIEW public.user_token_limits SET (security_invoker = on);

-- Optional: Update any existing stored procedures that reference user_profiles.daily_token_limit
-- to use the new tier-based system

-- Add a comment to document the change
COMMENT ON FUNCTION public.get_user_token_limit(UUID) IS 
'Returns daily token limit based on user subscription tier: Tier 1 = 20k, Tier 2 = 150k, Tier 3 = 400k, Tier 4 = Unlimited';

COMMENT ON VIEW public.user_token_limits IS 
'View providing user token limits based on subscription tier';

-- Optional: Add a trigger to log when tier changes affect token limits
CREATE OR REPLACE FUNCTION public.log_tier_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tier IS DISTINCT FROM NEW.tier THEN
        -- You can add logging here if needed
        RAISE NOTICE 'User % tier changed from % to %, token limit changed from % to %',
            NEW.user_id,
            OLD.tier,
            NEW.tier,
            CASE OLD.tier
                WHEN 1 THEN 20000
                WHEN 2 THEN 150000
                WHEN 3 THEN 400000
                WHEN 4 THEN 999999999
                ELSE 20000
            END,
            CASE NEW.tier
                WHEN 1 THEN 20000
                WHEN 2 THEN 150000
                WHEN 3 THEN 400000
                WHEN 4 THEN 999999999
                ELSE 20000
            END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_tier_change
    AFTER UPDATE OF tier ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_tier_change();