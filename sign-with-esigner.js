// Custom signing script for SSL.com eSigner CKA
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(configuration) {
  const filePath = configuration.path;
  const fileName = path.basename(filePath);
  
  console.log(`\n🔏 Signing ${fileName}...`);
  
  // Find signtool.exe - check multiple possible locations
  const signtoolPaths = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22000.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\x64\\signtool.exe',
    'C:\\Program Files\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\x64\\signtool.exe'
  ];
  
  let signtool = 'signtool'; // fallback to PATH
  for (const toolPath of signtoolPaths) {
    if (fs.existsSync(toolPath)) {
      signtool = `"${toolPath}"`;
      console.log(`  Found signtool at: ${toolPath}`);
      break;
    }
  }
  
  if (signtool === 'signtool') {
    console.log('  ⚠️ signtool.exe not found in common locations, trying PATH...');
  }
  
  // Multiple retry attempts with different approaches
  const maxAttempts = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`  Attempt ${attempt}/${maxAttempts}...`);
    
    try {
      // Build the signtool command
      const commands = [
        // Try with subject name
        `${signtool} sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /d "RadPal" "${filePath}"`,
        // Try with SHA1 hash
        `${signtool} sign /sha1 4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC /tr http://ts.ssl.com /td sha256 /fd sha256 /d "RadPal" "${filePath}"`,
        // Try with different timestamp server
        `${signtool} sign /n "RADPAL LLC" /tr http://timestamp.sectigo.com /td sha256 /fd sha256 /d "RadPal" "${filePath}"`
      ];
      
      for (const cmd of commands) {
        try {
          console.log(`  Trying: ${cmd.substring(0, 50)}...`);
          
          // Execute with longer timeout for cloud signing
          const output = execSync(cmd, {
            timeout: 60000, // 60 second timeout
            stdio: 'pipe'
          });
          
          console.log(`✅ Successfully signed: ${fileName}`);
          return; // Success!
          
        } catch (cmdError) {
          lastError = cmdError;
          // Continue to next command
        }
      }
      
    } catch (error) {
      lastError = error;
      console.log(`  ❌ Attempt ${attempt} failed: ${error.message?.split('\n')[0]}`);
      
      if (attempt < maxAttempts) {
        console.log(`  ⏳ Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to restart eSigner CKA between attempts
        if (attempt === 2) {
          console.log(`  🔄 Attempting to restart eSigner CKA service...`);
          try {
            execSync('net stop "eSigner CKA"', { stdio: 'ignore' });
            await new Promise(resolve => setTimeout(resolve, 2000));
            execSync('net start "eSigner CKA"', { stdio: 'ignore' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`  ✅ eSigner CKA restarted`);
          } catch (serviceError) {
            console.log(`  ⚠️ Could not restart eSigner CKA (may require admin rights)`);
          }
        }
      }
    }
  }
  
  // All attempts failed
  console.error(`\n❌ Failed to sign ${fileName} after ${maxAttempts} attempts`);
  console.error('\n📋 Troubleshooting steps:');
  console.error('1. Make sure eSigner CKA is running and you are logged in');
  console.error('2. Check that your certificate is valid: certutil -user -store My "RADPAL LLC"');
  console.error('3. Try manual signing: signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 test.txt');
  console.error('4. If manual signing works, run: build-without-signing.cmd');
  console.error('\nLast error:', lastError?.message);
  
  // Don't throw error - let build continue unsigned
  console.warn('\n⚠️ Continuing build without signing. You can sign manually later.');
};