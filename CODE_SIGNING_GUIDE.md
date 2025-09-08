# Windows Code Signing Guide for RadPal

## Overview
Code signing is essential for distributing RadPal without Windows SmartScreen warnings and to ensure users can trust the application.

## Prerequisites

### 1. Code Signing Certificate
You'll need an EV (Extended Validation) or OV (Organization Validation) code signing certificate from a trusted Certificate Authority:

**Recommended Certificate Authorities:**
- DigiCert ($474/year for OV, $699/year for EV)
- Sectigo/Comodo ($179-$399/year)
- GlobalSign ($289-$589/year)
- SSL.com ($199-$399/year)

**Note:** EV certificates provide immediate SmartScreen reputation, while OV certificates may need to build reputation over time.

### 2. Certificate Setup

#### Option A: Using Windows Certificate Store (Recommended for EV)
If your certificate is installed in Windows Certificate Store:
```json
"win": {
  "certificateSubjectName": "RADPAL LLC",
  "rfc3161TimeStampServer": "http://timestamp.digicert.com"
}
```

#### Option B: Using PFX File (Common for OV)
If you have a .pfx or .p12 file:
```json
"win": {
  "certificateFile": "./certs/radpal-cert.pfx",
  "certificatePassword": "${env.CERT_PASSWORD}",
  "rfc3161TimeStampServer": "http://timestamp.digicert.com"
}
```

## Configuration Added to package.json

```json
"win": {
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ],
  "artifactName": "RadPal.Setup.${version}.${ext}",
  "certificateSubjectName": "RADPAL LLC",
  "rfc3161TimeStampServer": "http://timestamp.digicert.com",
  "signingHashAlgorithms": ["sha256"],
  "publisherName": "RADPAL LLC",
  "verifyUpdateCodeSignature": true
}
```

### Configuration Explained:
- **certificateSubjectName**: Must match the Subject Name on your certificate exactly
- **rfc3161TimeStampServer**: Ensures signature remains valid after certificate expires
- **signingHashAlgorithms**: SHA256 is the modern standard
- **publisherName**: Should match your certificate's organization name
- **verifyUpdateCodeSignature**: Ensures auto-updates are also signed

## Environment Variables

For security, use environment variables for sensitive information:

### Windows (Command Prompt):
```cmd
set CERT_PASSWORD=your_certificate_password
npm run build
```

### Windows (PowerShell):
```powershell
$env:CERT_PASSWORD="your_certificate_password"
npm run build
```

### Using .env file (add to .gitignore!):
```env
CERT_PASSWORD=your_certificate_password
```

## Building with Code Signing

### 1. Install Certificate (if using Windows Store):
- Double-click your .pfx file
- Follow the Certificate Import Wizard
- Choose "Current User" or "Local Machine"
- Enter the certificate password

### 2. Build the Application:
```bash
npm run build
```

### 3. Verify Signature:
Right-click on the generated installer → Properties → Digital Signatures tab

## Troubleshooting

### Error: "Cannot find certificate"
- Verify the certificate subject name matches exactly
- Check certificate is installed in correct store
- Try using `certutil -store My` to list certificates

### Error: "Timestamp server timeout"
Try alternative timestamp servers:
- `http://timestamp.digicert.com`
- `http://timestamp.sectigo.com`
- `http://timestamp.globalsign.com/scripts/timstamp.dll`
- `http://timestamp.comodoca.com/authenticode`

### SmartScreen Still Shows Warning
- For OV certificates, you need to build reputation (usually 1-2 weeks)
- Submit your app to Microsoft for manual review
- Consider upgrading to EV certificate for immediate trust

## Security Best Practices

1. **Never commit certificate files or passwords to Git**
   - Add to .gitignore:
     ```
     *.pfx
     *.p12
     *.cer
     .env
     ```

2. **Use CI/CD for signing**
   - Store certificate in GitHub Secrets or secure vault
   - Sign only in production builds

3. **Renew certificates before expiration**
   - Certificates typically last 1-3 years
   - Set calendar reminders 60 days before expiration

## Testing Code Signing

1. Build the installer with signing enabled
2. Upload to a test server or cloud storage
3. Download on a clean Windows machine
4. Verify no SmartScreen warnings appear
5. Check digital signature in file properties

## Additional Notes

- Code signing only works on Windows builds
- Mac builds require separate Apple Developer certificate ($99/year)
- Linux builds typically don't require signing
- Keep your certificate and private key secure - if compromised, it must be revoked immediately

## Resources

- [Electron Builder Code Signing Docs](https://www.electron.build/code-signing)
- [Microsoft SmartScreen Documentation](https://docs.microsoft.com/en-us/windows/security/threat-protection/microsoft-defender-smartscreen/microsoft-defender-smartscreen-overview)
- [DigiCert Code Signing Guide](https://www.digicert.com/signing/code-signing-certificates)