# SSL.com EV Certificate Signing Fix

## The Issue
You have an SSL.com EV Code Signing certificate, but getting error `SignerSign() failed (0x80090003)`. This happens because SSL.com EV certificates require special handling.

## Solution 1: Use SSL.com eSigner Tool (Recommended for EV)

SSL.com EV certificates are stored in the cloud and require their eSigner tool.

### Steps:

1. **Install eSigner CKA (Cloud Key Adapter)**:
   - Download from: https://www.ssl.com/download/ssl-com-esigner-cka/
   - Install and restart your computer

2. **Configure eSigner**:
   ```cmd
   # Set your SSL.com credentials
   set ESIGNER_USERNAME=your_ssl_com_username
   set ESIGNER_PASSWORD=your_ssl_com_password
   set ESIGNER_TOTP_SECRET=your_2fa_secret
   ```

3. **Update package.json** to use custom sign tool:
   ```json
   "win": {
     "sign": "./sign.js",
     "signingHashAlgorithms": ["sha256"],
     "rfc3161TimeStampServer": "http://ts.ssl.com"
   }
   ```

4. **Create sign.js** in project root:
   ```javascript
   exports.default = async function(configuration) {
     const { exec } = require('child_process');
     const { promisify } = require('util');
     const execAsync = promisify(exec);
     
     const path = configuration.path;
     const hash = configuration.hash || 'sha256';
     
     // Use eSigner for signing
     const command = `esigner sign -username="${process.env.ESIGNER_USERNAME}" -password="${process.env.ESIGNER_PASSWORD}" -totp_secret="${process.env.ESIGNER_TOTP_SECRET}" -input_file="${path}" -override=true`;
     
     try {
       await execAsync(command);
       console.log(`Successfully signed: ${path}`);
     } catch (error) {
       console.error(`Failed to sign: ${path}`, error);
       throw error;
     }
   };
   ```

## Solution 2: Use Windows Certificate Store Directly

If the certificate is properly installed with its private key:

1. **Check certificate installation**:
   ```cmd
   certutil -user -store My
   ```
   Look for your RADPAL LLC certificate

2. **Ensure private key permissions**:
   ```cmd
   # Run as Administrator
   certutil -repairstore My "4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC"
   ```

3. **Try building without subject name** (use SHA1 directly):
   Already updated in package.json to use `certificateSha1` instead of `certificateSubjectName`

## Solution 3: Manual Signing (Temporary Workaround)

1. **Build without signing**:
   ```json
   "win": {
     "sign": false
   }
   ```

2. **Sign manually after build**:
   ```cmd
   signtool sign /sha1 4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC /tr http://ts.ssl.com /td sha256 /fd sha256 "dist\RadPal.Setup.1.0.12.exe"
   ```

## Solution 4: Use SSL.com's CodeSignTool

1. **Download CodeSignTool**:
   ```cmd
   curl -L https://www.ssl.com/download/codesigntool-for-windows/ -o CodeSignTool.zip
   ```

2. **Sign with CodeSignTool**:
   ```cmd
   CodeSignTool.bat sign -username=your_username -password=your_password -totp_secret=your_totp -input_file="dist\RadPal.Setup.1.0.12.exe"
   ```

## Troubleshooting Commands

### Check if private key is accessible:
```cmd
certutil -user -store My "RADPAL LLC"
```

### Test manual signing:
```cmd
signtool sign /debug /v /sha1 4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC /tr http://ts.ssl.com /td sha256 test.exe
```

### Check certificate chain:
```cmd
certutil -user -verify -urlfetch "4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC"
```

## Important Notes

- SSL.com EV certificates are stored in the cloud, not locally
- You need active internet connection to sign
- 2FA/TOTP is required for each signing operation
- Consider using CI/CD with GitHub Actions for automated signing

## Next Steps

1. Try the updated package.json configuration
2. If it still fails, implement the custom sign.js script
3. Contact SSL.com support if issues persist - they have specific requirements for EV certificates