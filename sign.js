// Custom signing script for SSL.com EV certificate
exports.default = async function(configuration) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const path = require('path');
  const execAsync = promisify(exec);
  
  const filePath = configuration.path;
  const hash = configuration.hash || 'sha256';
  
  console.log(`Signing ${filePath}...`);
  
  // Method 1: Try standard signtool with SHA1 hash
  const sha1 = '4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC';
  const signtoolCmd = `signtool sign /sha1 ${sha1} /tr http://ts.ssl.com /td ${hash} /fd ${hash} /d "RadPal" "${filePath}"`;
  
  try {
    console.log('Attempting to sign with signtool...');
    const { stdout, stderr } = await execAsync(signtoolCmd);
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('Successfully signed')) {
      console.error('SignTool warning:', stderr);
    }
    console.log(`✓ Successfully signed: ${path.basename(filePath)}`);
    return;
  } catch (error) {
    console.log('Standard signtool failed, trying alternative methods...');
    
    // Method 2: Try with eSigner if available
    if (process.env.ESIGNER_USERNAME && process.env.ESIGNER_PASSWORD) {
      const esignerCmd = `esigner sign -username="${process.env.ESIGNER_USERNAME}" -password="${process.env.ESIGNER_PASSWORD}" -totp_secret="${process.env.ESIGNER_TOTP_SECRET || ''}" -input_file="${filePath}" -override=true`;
      
      try {
        console.log('Attempting to sign with eSigner...');
        const { stdout, stderr } = await execAsync(esignerCmd);
        if (stdout) console.log(stdout);
        console.log(`✓ Successfully signed with eSigner: ${path.basename(filePath)}`);
        return;
      } catch (esignerError) {
        console.error('eSigner failed:', esignerError.message);
      }
    }
    
    // Method 3: Try CodeSignTool if available
    if (process.env.SSL_COM_USERNAME && process.env.SSL_COM_PASSWORD) {
      const codeSignToolPath = path.join(__dirname, 'CodeSignTool', 'CodeSignTool.bat');
      const codeSignCmd = `"${codeSignToolPath}" sign -username=${process.env.SSL_COM_USERNAME} -password=${process.env.SSL_COM_PASSWORD} -totp_secret=${process.env.SSL_COM_TOTP || ''} -input_file="${filePath}"`;
      
      try {
        console.log('Attempting to sign with CodeSignTool...');
        const { stdout, stderr } = await execAsync(codeSignCmd);
        if (stdout) console.log(stdout);
        console.log(`✓ Successfully signed with CodeSignTool: ${path.basename(filePath)}`);
        return;
      } catch (codeSignError) {
        console.error('CodeSignTool failed:', codeSignError.message);
      }
    }
    
    // If all methods fail, throw the original error
    console.error('All signing methods failed. Original error:', error.message);
    throw new Error(`Failed to sign ${filePath}. Please check SSL_COM_SIGNING_FIX.md for troubleshooting.`);
  }
};