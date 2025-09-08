const fs = require('fs');
const path = require('path');

// Make dotenv optional for production builds
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not found, using environment variables directly');
}

// Generate config.js with ONLY public Supabase configuration
// API keys are now handled through the Supabase proxy
const config = `// This file is generated at build time
// DO NOT COMMIT THIS FILE TO VERSION CONTROL
module.exports = {
  VITE_SUPABASE_URL: '${process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co'}',
  VITE_SUPABASE_ANON_KEY: '${process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'}',
  // API keys removed - now handled through Supabase proxy
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GEMINI_API_KEY: '',
  MOONSHOT_API_KEY: '',
  // Deepgram now uses auth endpoint - no embedded key
  DEEP_GRAM_API: ''
};`;

const configPath = path.join(__dirname, '..', 'electron', 'config.js');
fs.writeFileSync(configPath, config);
console.log('Config file generated successfully');