-- Create reports table for saving radiology reports with findings, initial results, and edited results
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_type TEXT NOT NULL,
  findings TEXT NOT NULL,
  initial_result TEXT NOT NULL,
  edited_result TEXT,
  model_used TEXT,
  tokens_used JSONB,
  prompt_used TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_reports_user_id ON public.reports(user_id);
CREATE INDEX idx_reports_study_type ON public.reports(study_type);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX idx_reports_user_study ON public.reports(user_id, study_type);

-- Add full text search indexes for searching content
CREATE INDEX idx_reports_findings_fts ON public.reports USING GIN(to_tsvector('english', findings));
CREATE INDEX idx_reports_initial_result_fts ON public.reports USING GIN(to_tsvector('english', initial_result));
CREATE INDEX idx_reports_edited_result_fts ON public.reports USING GIN(to_tsvector('english', edited_result));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own reports
CREATE POLICY "Users can view own reports" ON public.reports
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own reports
CREATE POLICY "Users can insert own reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own reports
CREATE POLICY "Users can update own reports" ON public.reports
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own reports
CREATE POLICY "Users can delete own reports" ON public.reports
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;