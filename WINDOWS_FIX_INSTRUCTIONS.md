# Windows Binary Fix Instructions

## The Issue
You're getting "Access is denied" and "This app can't run on your PC" because the existing `llama-server.exe` was built for Linux/WSL, not native Windows.

## Quick Fix

1. **Clean up the old binary:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\clean-windows.ps1
   ```
   
   Or manually delete:
   ```
   C:\Users\ssj4v\Desktop\radpal\llama.cpp\build\bin\llama-server.exe
   ```

2. **Run RadPal again:**
   ```cmd
   npm run electron
   ```
   
   The app will now:
   - Automatically download the correct Windows binary (~10MB)
   - Extract and set it up
   - Start the server
   - Download the model if needed (~4GB)

## Verify the Fix

After the download, you can test the binary:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-server.ps1
```

This will check:
- File exists and size
- File is unblocked
- Binary can execute
- Architecture is correct (should be x64)

## What Changed

- Updated download URL to use a working Windows release
- Added better error handling and logging
- Added automatic file unblocking for Windows
- Created helper scripts for cleanup and testing

## If It Still Doesn't Work

1. Make sure you deleted the old binary completely
2. Check Windows Defender isn't blocking the download
3. Try running as Administrator (though it shouldn't be needed)
4. Check the console output for specific error messages

The automatic download should now work correctly on Windows!