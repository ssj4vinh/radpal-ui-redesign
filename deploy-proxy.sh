#!/bin/bash

echo "🚀 Deploying RadPal API Proxy to Supabase"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if not already)
echo "📝 Logging in to Supabase..."
supabase login

# Link to your project
echo "🔗 Linking to your Supabase project..."
echo "Enter your project ref (from Supabase dashboard URL):"
read PROJECT_REF
supabase link --project-ref $PROJECT_REF

# Deploy the function
echo "📦 Deploying AI proxy function..."
supabase functions deploy ai-proxy

# Set environment variables (secrets)
echo "🔐 Setting environment variables..."
echo "Enter your OpenAI API key:"
read -s OPENAI_KEY
supabase secrets set OPENAI_API_KEY=$OPENAI_KEY

echo "Enter your Anthropic API key:"
read -s ANTHROPIC_KEY
supabase secrets set ANTHROPIC_API_KEY=$ANTHROPIC_KEY

echo "Enter your Deepgram API key:"
read -s DEEPGRAM_KEY
supabase secrets set DEEPGRAM_API_KEY=$DEEPGRAM_KEY

echo "✅ Deployment complete!"
echo ""
echo "Your API proxy is now live at:"
echo "https://$PROJECT_REF.supabase.co/functions/v1/ai-proxy"
echo ""
echo "Next steps:"
echo "1. Update your app to use the proxy endpoint"
echo "2. Remove API keys from the Electron app"
echo "3. Test with a few users before wide release"