#!/usr/bin/env node
/**
 * Windows Dependencies Installer for RadPal
 * Installs required dependencies for Windows audio recording and PowerMic support
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Installing RadPal Windows dependencies...\n');

// Function to run commands safely
function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Please run this script from the RadPal root directory.');
  process.exit(1);
}

console.log('📋 Installing required npm packages...');

// Install core dependencies
const dependencies = [
  'mic',         // For Windows audio recording without sox
  'node-hid'     // For PowerMic support
];

for (const dep of dependencies) {
  if (!runCommand(`npm install ${dep}`, `Installing ${dep}`)) {
    console.log(`⚠️ Failed to install ${dep}, but continuing...`);
  }
}

console.log('🔧 Building application...');
if (runCommand('npm run build', 'Building RadPal')) {
  console.log('🎉 Setup complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm run electron');
  console.log('   2. Test the microphone button');
  console.log('   3. If you have a PowerMic, it should now work');
  console.log('\n💡 Note: You may need to grant microphone permissions when prompted.');
} else {
  console.log('❌ Build failed. Please check the error messages above.');
}