const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class KeyManager {
  constructor() {
    // API keys are now handled through Supabase proxy
    // Only public Supabase configuration is stored
    this.publicConfig = {
      supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://ynzikfmpzhtohwsfniqv.supabase.co',
      supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluemlrZm1wemh0b2h3c2ZuaXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNjc5NzYsImV4cCI6MjA2NTY0Mzk3Nn0.uHIXkVvI03vjZ0XdLPkkznME1K0ivDJ6FVU2VeoJdHc'
    };
  }

  loadKeys() {
    // No longer loading API keys - they're handled server-side
    console.log('API keys are managed through Supabase proxy');
  }

  // Basic obfuscation (NOT cryptographically secure, just prevents casual inspection)
  obfuscateKeys(keys) {
    const data = JSON.stringify(keys);
    const cipher = crypto.createCipher('aes-256-cbc', 'radpal-2024-medical-ai');
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  deobfuscateKeys(encryptedData) {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', 'radpal-2024-medical-ai');
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt keys:', error);
      return {};
    }
  }

  getKey(service) {
    // API keys are no longer stored locally
    // Return public config for Supabase
    if (service === 'supabaseUrl') {
      return this.publicConfig.supabaseUrl;
    }
    if (service === 'supabaseKey') {
      return this.publicConfig.supabaseKey;
    }
    
    // All other keys are handled through proxy
    console.log(`API key for ${service} is managed through Supabase proxy`);
    return null;
  }

  // Get all keys (for backward compatibility)
  getAllKeys() {
    // Only return public configuration
    return {
      supabaseUrl: this.publicConfig.supabaseUrl,
      supabaseKey: this.publicConfig.supabaseKey
    };
  }

  // Check if keys are available
  hasKeys() {
    // We always have public config
    return true;
  }
}

// Singleton instance
let keyManagerInstance = null;

function getKeyManager() {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
  }
  return keyManagerInstance;
}

module.exports = { getKeyManager };