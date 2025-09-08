@echo off
echo 🔧 RadPal Windows Fix Script
echo ============================
echo.

echo 📦 Installing missing packages...
call npm install mic node-hid
if %errorlevel% neq 0 (
    echo ❌ Failed to install packages
    echo 💡 Try running as administrator or check your npm installation
    pause
    exit /b %errorlevel%
)

echo.
echo 🔧 Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo    1. Run: npm run electron
echo    2. Click the microphone button to test
echo    3. Grant microphone permissions if prompted
echo.
echo 💡 If PowerMic still doesn't work, you may need to:
echo    - Install device drivers
echo    - Check USB connection
echo    - Run Windows as administrator once to set permissions
echo.
pause