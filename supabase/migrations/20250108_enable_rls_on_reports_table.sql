-- Enable Row Level Security on reports table
-- This ensures that the security policies are actually enforced
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Verify that RLS is enabled (for documentation purposes)
-- RLS must be enabled for the policies to take effect
-- Without this, all authenticated users could potentially see all reports