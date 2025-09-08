# eSigner CKA Setup Guide for RadPal Code Signing

## Overview
Since you have SSL.com's eSigner CKA installed, it should make your EV certificate available to standard Windows signing tools like signtool.exe.

## Prerequisites
1. eSigner CKA is installed and running
2. You're logged into eSigner CKA with your SSL.com credentials
3. Your certificate shows in Windows Certificate Store

## Verify CKA Setup

### 1. Check if eSigner CKA Service is Running:
```cmd
# Open Services (Windows + R, type services.msc)
# Look for "eSigner CKA" service - should be Running
```

### 2. Verify Certificate in Store:
```cmd
# Run in Command Prompt:
certutil -user -store My

# You should see:
# RADPAL LLC
# SSL.com EV Code Signing Intermediate CA RSA R3
```

### 3. Test Manual Signing:
```cmd
# Create a test file
echo test > test.txt

# Try to sign it
signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /v test.txt
```

## Fixing the SignerSign() Error

The error `0x80090003` (NTE_BAD_KEY_STATE) usually means:

### Solution 1: Restart eSigner CKA
```cmd
# Run as Administrator
net stop "eSigner CKA"
net start "eSigner CKA"
```

### Solution 2: Re-authenticate with eSigner
1. Open eSigner CKA from system tray
2. Sign out
3. Sign back in with your SSL.com credentials
4. Make sure 2FA/TOTP is completed

### Solution 3: Clear Certificate Cache
```cmd
# Run as Administrator
certutil -user -delstore My "RADPAL LLC"
# Then restart eSigner CKA to reload certificate
```

### Solution 4: Use CSP Instead of CNG
Sometimes the CNG provider has issues. Try forcing CSP:
```json
"win": {
  "certificateSubjectName": "RADPAL LLC",
  "cscInfo": {
    "provider": "Microsoft Enhanced RSA and AES Cryptographic Provider"
  }
}
```

## Environment Setup for Build

Before building, ensure:

1. **eSigner CKA is running and authenticated**
2. **Set timeout for cloud signing** (already in package.json)
3. **Internet connection is stable** (cloud signing requires it)

## Build Command
```cmd
# Clean build
rmdir /s /q dist
npm run build
```

## If Still Failing

### Try Direct SignTool Command:
```cmd
signtool sign /n "RADPAL LLC" /tr http://ts.ssl.com /td sha256 /fd sha256 /debug /v "dist\win-unpacked\RadPal.exe"
```

This will show detailed debug info about what's failing.

### Check Certificate Private Key:
```cmd
certutil -user -store My "RADPAL LLC" | findstr "Provider"
```

Should show the eSigner CKA provider.

### Alternative: Use SHA1 Hash Instead:
```json
"win": {
  "certificateSha1": "4D7B1EEBE69F474906FF07360CC5BB5C772D7FFC",
  "rfc3161TimeStampServer": "http://ts.ssl.com"
}
```

## Common Issues and Fixes

### "The specified network password is not correct"
- eSigner CKA needs re-authentication
- Log out and back into eSigner CKA

### "Cannot find certificate"
- eSigner CKA service not running
- Certificate not loaded into store
- Wrong certificate name/hash

### "SignerSign() failed"
- Private key not accessible
- Need to restart eSigner CKA
- Network connectivity issues with SSL.com servers

## Support Contacts

- SSL.com Support: support@ssl.com
- eSigner Documentation: https://www.ssl.com/guide/esigner-cloud-key-adapter
- SSL.com Code Signing Guide: https://www.ssl.com/how-to/using-your-code-signing-certificate/

## Next Steps

1. Verify eSigner CKA is running and authenticated
2. Try the build again with `npm run build`
3. If it fails, test manual signing with the debug command above
4. The debug output will tell us exactly what's wrong