-- Create dictation usage tracking table
CREATE TABLE IF NOT EXISTS dictation_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes_used DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create index for faster queries
CREATE INDEX idx_dictation_usage_user_date ON dictation_usage(user_id, date);

-- Enable Row Level Security
ALTER TABLE dictation_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own dictation usage" ON dictation_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert own dictation usage" ON dictation_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records  
CREATE POLICY "Users can update own dictation usage" ON dictation_usage
  FOR UPDATE USING (auth.uid() = user_id);