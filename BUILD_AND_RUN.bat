@echo off
echo Building RadPal with enhanced Logic Editor...
echo.

echo Step 1: Building the app...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed! Check the error messages above.
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.

echo Step 2: Starting Electron...
call npm run electron

pause