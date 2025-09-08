#!/usr/bin/env node

/**
 * Build-time script to embed API keys into the application
 * This provides obfuscation but NOT true security
 * 
 * For production use, consider:
 * 1. Server-side proxy for API calls
 * 2. User-provided keys
 * 3. Paid license keys that unlock features
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load keys from environment variables or .env.backup
function loadKeysFromEnvironment() {
  // Try to load from .env.backup if it exists
  const envBackupPath = path.join(__dirname, '..', '.env.backup');
  if (fs.existsSync(envBackupPath)) {
    const envContent = fs.readFileSync(envBackupPath, 'utf8');
    const lines = envContent.split('\n');
    
    const keys = {};
    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }

  return {
    openai: process.env.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    deepgram: process.env.DEEPGRAM_API_KEY || '',
    supabaseUrl: process.env.VITE_SUPABASE_URL || '',
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    moonshot: process.env.MOONSHOT_API_KEY || '',
    google: process.env.GOOGLE_API_KEY || '',
    groq: process.env.GROQ_API_KEY || ''
  };
}

// Obfuscate keys (basic protection against casual inspection)
function obfuscateKeys(keys) {
  const data = JSON.stringify(keys);
  const cipher = crypto.createCipher('aes-256-cbc', 'radpal-2024-medical-ai');
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Main build function
function buildKeys() {
  console.log('🔐 API keys are now handled through Supabase proxy');
  console.log('✅ No keys will be embedded in the build');
  console.log('🔒 API security is managed server-side');
  
  // Remove any existing .keys file from previous builds
  const outputPath = path.join(__dirname, '..', 'electron', '.keys');
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log('🗑️  Removed old .keys file');
  }
  
  // Only keep Supabase public configuration
  const publicConfig = {
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co',
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
  };
  
  console.log('📍 Using Supabase proxy at:', publicConfig.supabaseUrl);
}

// Run the build
buildKeys();