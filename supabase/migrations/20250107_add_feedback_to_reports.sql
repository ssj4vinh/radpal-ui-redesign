-- Add user_feedback column to reports table for tracking issues with generated output
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS user_feedback TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.reports.user_feedback IS 'Optional user feedback describing what was wrong with the AI-generated output before editing';